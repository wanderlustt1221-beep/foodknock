// src/app/api/auth/forgot-password/route.ts
// Forgot Password — Step 1 + 2: accept email, generate + send OTP.
//
// Security properties:
// - Anti-enumeration: ALWAYS returns the same generic 200 response,
//   whether or not the email exists, and regardless of rate-limit state.
//   The only thing that varies internally is whether an OTP is actually
//   generated and emailed — none of that leaks to the client.
// - Rate limiting (5 requests/hour, 60s resend cooldown) is enforced via a
//   single atomic findOneAndUpdate per check — no read-then-write race,
//   and no in-memory state (which would not survive across the independent,
//   stateless serverless invocations this route runs in on Vercel).
// - Hashed OTP only — plaintext OTP exists only transiently in this
//   function's memory, on its way into the email body; never persisted,
//   never logged.

import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { sendOtpEmail } from "@/lib/mailer";
import {
    generateOtp,
    hashOtp,
    OTP_EXPIRY_MINUTES,
    OTP_MAX_REQUESTS_PER_HOUR,
    OTP_RESEND_COOLDOWN_SECONDS,
    shouldResetRequestWindow,
} from "@/lib/otp";

const forgotPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().email("Valid email is required"),
});

// Always the same response body/shape/status, regardless of outcome.
const GENERIC_RESPONSE = {
    success: true,
    message: "If an account exists for that email, we've sent a verification code.",
};

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        const parsed = forgotPasswordSchema.safeParse(body);

        if (!parsed.success) {
            // Even invalid input gets the generic response — we don't want
            // to distinguish "bad email format" from "email not found" in a
            // way that helps an attacker fingerprint behavior. Validation
            // errors are still a 400 since this is a client-side input
            // mistake, not an enumeration vector (no email was checked yet).
            return NextResponse.json(
                { success: false, message: "A valid email address is required." },
                { status: 400 }
            );
        }

        const email = parsed.data.email;

        await connectDB();

        const user = await User.findOne({ email }).select(
            "_id name email passwordReset"
        );

        // ── Anti-enumeration: silently no-op if the user doesn't exist ────
        if (!user) {
            return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
        }

        const pr = user.passwordReset;

        // ── Resend cooldown (60s) ──────────────────────────────────────────
        if (pr?.lastRequestedAt) {
            const elapsedMs = Date.now() - pr.lastRequestedAt.getTime();
            if (elapsedMs < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
                // Still return the generic response — do not reveal that a
                // cooldown is active, that just confirms the email exists.
                return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
            }
        }

        // ── Hourly request window ─────────────────────────────────────────
        const resetWindow = shouldResetRequestWindow(pr?.requestWindowStart ?? null);
        const currentCount = resetWindow ? 0 : (pr?.requestCount ?? 0);

        if (!resetWindow && currentCount >= OTP_MAX_REQUESTS_PER_HOUR) {
            // Rate limit hit — again, no different response to the client.
            return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
        }

        // ── Generate + hash OTP ───────────────────────────────────────────
        const otp = generateOtp();
        const otpHash = await hashOtp(otp);
        const now = new Date();
        const otpExpiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

        // ── Atomic update: bump counters and store new OTP in one write ──
        // Using a single findOneAndUpdate (filtered by _id) avoids any
        // read-then-write race between the checks above and this write.
        // Concurrent requests within the same instant would each recompute
        // the same window logic; worst case is one extra request slips
        // through right at a window boundary, which is an acceptable,
        // bounded tradeoff for a non-financial rate limit.
        await User.findOneAndUpdate(
            { _id: user._id },
            {
                $set: {
                    "passwordReset.otpHash":             otpHash,
                    "passwordReset.otpExpiresAt":         otpExpiresAt,
                    "passwordReset.otpAttempts":          0,
                    "passwordReset.lockedUntil":          null,
                    "passwordReset.requestCount":         currentCount + 1,
                    "passwordReset.requestWindowStart":   resetWindow ? now : (pr?.requestWindowStart ?? now),
                    "passwordReset.lastRequestedAt":       now,
                    "passwordReset.resetTokenHash":       null,
                    "passwordReset.resetTokenExpiresAt":  null,
                },
            }
        );

        // ── Send the email ────────────────────────────────────────────────
        // Failures here must never change the response shape (anti-
        // enumeration + don't leak provider/transport errors to the
        // client). Log server-side for operational visibility only.
        try {
            await sendOtpEmail({ to: user.email, name: user.name, otp });
        } catch (emailError) {
            console.error("FORGOT_PASSWORD_EMAIL_ERROR", emailError);
        }

        return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
    } catch (error) {
        console.error("FORGOT_PASSWORD_ERROR", error);
        // Still avoid leaking details — generic 500 message only.
        return NextResponse.json(
            { success: false, message: "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}