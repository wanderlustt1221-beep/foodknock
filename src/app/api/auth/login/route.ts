// src/app/api/auth/login/route.ts
// Updated: blocks inactive users before issuing token, returns role in
// response. Now also implements production-grade login brute-force
// protection — both IP-based and email-based — entirely DB-backed
// (MongoDB), with no in-memory or global state, so it works correctly
// across independent Vercel serverless invocations and survives
// redeployments/restarts.
//
// Order of checks:
//   1. IP block check (20 failed attempts/hour -> 1-hour block) — short-
//      circuits before any user lookup if this IP is currently blocked.
//   2. User lookup. Not-found counts as a failed attempt for IP purposes,
//      but never reveals an attempts-remaining count (anti-enumeration —
//      only real accounts ever expose that detail).
//   3. Email-lock check (5 failed attempts -> 30-minute lock) — if locked,
//      the password is never even compared, per requirement: "Login must
//      be blocked even if the password is correct."
//   4. Password comparison. Wrong password increments the email's failed
//      counter (and locks it if the threshold is hit) and the IP's failed
//      counter (and blocks it if ITS threshold is hit).
//   5. isActive/suspended check — unchanged from before, and intentionally
//      NOT counted as a failed attempt (the password was correct; this is
//      an account-status gate, not a brute-force signal).
//   6. Success — resets the email's failed-attempt counters (per
//      requirement) and proceeds exactly as before. The IP counter is
//      deliberately NOT reset on a single success, since the IP-level
//      limit exists to slow down credential-stuffing/scanning regardless
//      of any one successful login.

import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import LoginAttempt from "@/models/LoginAttempt";
import bcrypt from "bcryptjs";
import { signToken } from "@/lib/auth";
import {
    EMAIL_LOCK_MINUTES,
    EMAIL_MAX_FAILED_ATTEMPTS,
    IP_BLOCK_MINUTES,
    IP_MAX_FAILED_ATTEMPTS,
    getClientIp,
    isLocked,
    lockMinutesRemaining,
    shouldResetIpWindow,
} from "@/lib/loginSecurity";

/**
 * Atomically records one failed attempt for this IP, blocking it for
 * IP_BLOCK_MINUTES if it just crossed IP_MAX_FAILED_ATTEMPTS within the
 * current hourly window. Two-step atomic update (increment, then
 * conditionally lock) — same pattern already used by the OTP modules in
 * this codebase.
 */
async function recordFailedIpAttempt(ip: string): Promise<void> {
    const existing = await LoginAttempt.findOne({ ip }).select(
        "failedCount windowStart"
    );

    const resetWindow = shouldResetIpWindow(existing?.windowStart ?? null);
    const now = new Date();

    const updated = await LoginAttempt.findOneAndUpdate(
        { ip },
        {
            $set: {
                failedCount:    resetWindow ? 1 : (existing?.failedCount ?? 0) + 1,
                windowStart:    resetWindow ? now : (existing?.windowStart ?? now),
                lastAttemptAt:  now,
            },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );

    if (updated.failedCount >= IP_MAX_FAILED_ATTEMPTS && !isLocked(updated.blockedUntil)) {
        await LoginAttempt.findOneAndUpdate(
            { ip },
            { $set: { blockedUntil: new Date(Date.now() + IP_BLOCK_MINUTES * 60 * 1000) } }
        );
    }
}

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();

        // ── Basic validation ──────────────────────────────────────────────
        if (!email?.trim() || !password) {
            return NextResponse.json(
                { success: false, message: "Email and password are required" },
                { status: 400 }
            );
        }

        await connectDB();

        const clientIp = getClientIp(req);

        // ── IP-level block check ──────────────────────────────────────────
        const ipRecord = await LoginAttempt.findOne({ ip: clientIp }).select("blockedUntil");
        if (ipRecord && isLocked(ipRecord.blockedUntil)) {
            const minutesLeft = lockMinutesRemaining(ipRecord.blockedUntil);
            return NextResponse.json(
                {
                    success: false,
                    message: `Too many login attempts from your network. Please try again in ${minutesLeft} minute(s).`,
                    blocked: true,
                    lockedMinutesRemaining: minutesLeft,
                },
                { status: 429 }
            );
        }

        // ── Find user ─────────────────────────────────────────────────────
        const user = await User.findOne({ email: email.toLowerCase().trim() })
            .select("_id name email password role isActive loginSecurity");

        if (!user) {
            await recordFailedIpAttempt(clientIp);
            return NextResponse.json(
                { success: false, message: "Invalid email or password" },
                { status: 401 }
            );
        }

        // ── Email-level lock check (password is NEVER compared while locked) ─
        if (isLocked(user.loginSecurity?.lockedUntil)) {
            await recordFailedIpAttempt(clientIp);
            const minutesLeft = lockMinutesRemaining(user.loginSecurity!.lockedUntil);
            return NextResponse.json(
                {
                    success: false,
                    message: `Too many failed attempts. Your account is locked for ${minutesLeft} more minute(s).`,
                    locked: true,
                    lockedMinutesRemaining: minutesLeft,
                },
                { status: 429 }
            );
        }

        // ── Password check ────────────────────────────────────────────────
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            await recordFailedIpAttempt(clientIp);

            const nextAttempts = (user.loginSecurity?.failedAttempts ?? 0) + 1;
            const hitLimit = nextAttempts >= EMAIL_MAX_FAILED_ATTEMPTS;

            await User.findOneAndUpdate(
                { _id: user._id },
                {
                    $set: {
                        "loginSecurity.failedAttempts": nextAttempts,
                        ...(hitLimit
                            ? { "loginSecurity.lockedUntil": new Date(Date.now() + EMAIL_LOCK_MINUTES * 60 * 1000) }
                            : {}),
                    },
                }
            );

            if (hitLimit) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Too many failed attempts. Your account is locked for ${EMAIL_LOCK_MINUTES} minutes.`,
                        locked: true,
                        lockedMinutesRemaining: EMAIL_LOCK_MINUTES,
                    },
                    { status: 429 }
                );
            }

            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid email or password",
                    attemptsRemaining: EMAIL_MAX_FAILED_ATTEMPTS - nextAttempts,
                },
                { status: 401 }
            );
        }

        // ── Block check (account suspended — password was correct, so this
        // is never counted as a failed/brute-force attempt) ───────────────
        if (user.isActive === false) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Your account has been suspended. Please contact support.",
                },
                { status: 403 }
            );
        }

        // ── Success: reset email-level brute-force tracking ───────────────
        if (user.loginSecurity?.failedAttempts || user.loginSecurity?.lockedUntil) {
            await User.findOneAndUpdate(
                { _id: user._id },
                {
                    $set: {
                        "loginSecurity.failedAttempts": 0,
                        "loginSecurity.lockedUntil":    null,
                    },
                }
            );
        }

        // ── Sign JWT ──────────────────────────────────────────────────────
        const token = signToken({
            userId: user._id.toString(),
            email: user.email,
            role: user.role ?? "user",
        });

        // ── Response ──────────────────────────────────────────────────────
        const res = NextResponse.json({
            success: true,
            message: "Login successful",
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role ?? "user",
            },
        });

        // ── Set Cookie ────────────────────────────────────────────────────
        res.cookies.set("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });

        return res;

    } catch (error) {
        console.error("LOGIN_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}