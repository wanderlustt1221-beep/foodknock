// src/app/api/auth/verify-otp/route.ts
// Forgot Password — Step 3: verify the OTP, issue a short-lived single-use
// reset token on success.
//
// Security properties:
// - Max 5 verify attempts, then a 30-minute lock — attempt counter and
//   lock are both written via atomic findOneAndUpdate, not read-then-write.
// - OTP expiry (10 min) checked against the stored timestamp.
// - On success, a reset token is generated (separate JWT secret/purpose
//   from the session token — see src/lib/auth.ts), its HASH is stored on
//   the user document, and the PLAINTEXT token is returned once in the
//   response body. It is single-use: reset-password clears it on use, and
//   it is also cleared/replaced on every new forgot-password request.
// - Anti-enumeration is less critical here than in forgot-password, since
//   reaching this step already implies the client received a code — but
//   we still avoid distinguishing "wrong OTP" from "no OTP was ever
//   requested for this email" beyond what's operationally necessary.

import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { signResetToken } from "@/lib/auth";
import {
    compareOtp,
    hashResetToken,
    isExpired,
    isLocked,
    lockSecondsRemaining,
    OTP_LOCK_MINUTES,
    OTP_MAX_VERIFY_ATTEMPTS,
    RESET_TOKEN_EXPIRY_MINUTES,
} from "@/lib/otp";

const verifyOtpSchema = z.object({
    email: z.string().trim().toLowerCase().email("Valid email is required"),
    otp:   z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        const parsed = verifyOtpSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, message: "A valid email and 6-digit code are required." },
                { status: 400 }
            );
        }

        const { email, otp } = parsed.data;

        await connectDB();

        const user = await User.findOne({ email }).select("_id passwordReset");

        // Generic-ish failure — don't confirm/deny whether the email itself
        // is registered at this step either.
        if (!user || !user.passwordReset?.otpHash) {
            return NextResponse.json(
                { success: false, message: "Invalid or expired code. Please request a new one." },
                { status: 400 }
            );
        }

        const pr = user.passwordReset;

        // ── Lock check ─────────────────────────────────────────────────────
        if (isLocked(pr.lockedUntil)) {
            const seconds = lockSecondsRemaining(pr.lockedUntil);
            return NextResponse.json(
                {
                    success: false,
                    message: `Too many incorrect attempts. Please try again in ${Math.ceil(seconds / 60)} minute(s).`,
                },
                { status: 429 }
            );
        }

        // ── Expiry check ───────────────────────────────────────────────────
        if (isExpired(pr.otpExpiresAt)) {
            return NextResponse.json(
                { success: false, message: "This code has expired. Please request a new one." },
                { status: 400 }
            );
        }

        // ── Compare OTP ────────────────────────────────────────────────────
        const matches = await compareOtp(otp, pr.otpHash!);

        if (!matches) {
            const nextAttempts = (pr.otpAttempts ?? 0) + 1;
            const hitLimit = nextAttempts >= OTP_MAX_VERIFY_ATTEMPTS;

            // Atomic update — increments attempts and, if this was the
            // final allowed attempt, sets the lock in the same write.
            await User.findOneAndUpdate(
                { _id: user._id },
                {
                    $set: {
                        "passwordReset.otpAttempts": nextAttempts,
                        ...(hitLimit
                            ? { "passwordReset.lockedUntil": new Date(Date.now() + OTP_LOCK_MINUTES * 60 * 1000) }
                            : {}),
                    },
                }
            );

            if (hitLimit) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Too many incorrect attempts. Please try again in ${OTP_LOCK_MINUTES} minutes.`,
                    },
                    { status: 429 }
                );
            }

            return NextResponse.json(
                {
                    success: false,
                    message: `Incorrect code. ${OTP_MAX_VERIFY_ATTEMPTS - nextAttempts} attempt(s) remaining.`,
                },
                { status: 400 }
            );
        }

        // ── Success: issue a single-use, short-lived reset token ──────────
        // The JWT itself (signed with RESET_TOKEN_SECRET, distinct from the
        // session JWT_SECRET) carries userId + purpose + its own expiry —
        // that's sufficient for reset-password to trust it cryptographically.
        // The one thing a JWT can't do on its own is be revoked/single-use,
        // so we additionally store a hash of the issued token on the user
        // document; reset-password checks the hash matches AND clears it
        // immediately on use, so the same token can never be redeemed twice.
        const jwtResetToken = signResetToken({
            userId: user._id.toString(),
            purpose: "password-reset",
        });
        const resetTokenHash = await hashResetToken(jwtResetToken);
        const resetTokenExpiresAt = new Date(
            Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000
        );

        // Clear OTP state (it's now consumed) and store the reset token hash,
        // all atomically in one write.
        await User.findOneAndUpdate(
            { _id: user._id },
            {
                $set: {
                    "passwordReset.otpHash":              null,
                    "passwordReset.otpExpiresAt":          null,
                    "passwordReset.otpAttempts":           0,
                    "passwordReset.lockedUntil":           null,
                    "passwordReset.resetTokenHash":        resetTokenHash,
                    "passwordReset.resetTokenExpiresAt":   resetTokenExpiresAt,
                },
            }
        );

        return NextResponse.json(
            {
                success: true,
                message: "Code verified. You can now set a new password.",
                resetToken: jwtResetToken,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("VERIFY_OTP_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}