// src/app/api/auth/resend-signup-otp/route.ts
// Resends the signup verification OTP for an in-progress PendingSignup.
// Takes only { email } — the rest of the registration data is already
// stored from the original /api/auth/register call, so the user never has
// to resubmit the full form just to get a new code.
//
// Same rate-limit rules as the initial send: 60s cooldown, 5 requests/hour,
// enforced via atomic updates (no in-memory state).

import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import PendingSignup from "@/models/PendingSignup";
import { sendSignupOtpEmail } from "@/lib/mailer";
import {
    generateOtp,
    hashOtp,
    OTP_EXPIRY_MINUTES,
    OTP_MAX_REQUESTS_PER_HOUR,
    OTP_RESEND_COOLDOWN_SECONDS,
    shouldResetRequestWindow,
} from "@/lib/otp";

const resendSchema = z.object({
    email: z.string().trim().toLowerCase().email("Valid email is required"),
});

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        const parsed = resendSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, message: "A valid email address is required." },
                { status: 400 }
            );
        }

        const email = parsed.data.email;

        await connectDB();

        const pending = await PendingSignup.findOne({ email });

        if (!pending) {
            // No pending signup exists for this email (expired via TTL,
            // never started, or already completed) — the client should
            // restart from the registration form.
            return NextResponse.json(
                { success: false, message: "No pending signup found for this email. Please register again." },
                { status: 404 }
            );
        }

        // ── Resend cooldown (60s) ──────────────────────────────────────────
        if (pending.lastRequestedAt) {
            const elapsedMs = Date.now() - pending.lastRequestedAt.getTime();
            if (elapsedMs < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
                const secondsLeft = Math.ceil((OTP_RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000);
                return NextResponse.json(
                    {
                        success: false,
                        message: `Please wait ${secondsLeft}s before requesting another code.`,
                    },
                    { status: 429 }
                );
            }
        }

        // ── Hourly request window ─────────────────────────────────────────
        const resetWindow = shouldResetRequestWindow(pending.requestWindowStart);
        const currentCount = resetWindow ? 0 : (pending.requestCount ?? 0);

        if (!resetWindow && currentCount >= OTP_MAX_REQUESTS_PER_HOUR) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Too many verification code requests. Please try again in an hour.",
                },
                { status: 429 }
            );
        }

        // ── Generate + hash a new OTP ──────────────────────────────────────
        const otp = generateOtp();
        const otpHash = await hashOtp(otp);
        const now = new Date();
        const otpExpiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

        await PendingSignup.findOneAndUpdate(
            { _id: pending._id },
            {
                $set: {
                    otpHash,
                    otpExpiresAt,
                    otpAttempts:        0,
                    lockedUntil:        null,
                    requestCount:       currentCount + 1,
                    requestWindowStart: resetWindow ? now : (pending.requestWindowStart ?? now),
                    lastRequestedAt:    now,
                },
            }
        );

        try {
            await sendSignupOtpEmail({ to: email, name: pending.name, otp });
        } catch (emailError) {
            console.error("RESEND_SIGNUP_OTP_EMAIL_ERROR", emailError);
            return NextResponse.json(
                { success: false, message: "Couldn't send the verification email. Please try again." },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { success: true, message: "A new verification code has been sent." },
            { status: 200 }
        );
    } catch (error) {
        console.error("RESEND_SIGNUP_OTP_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}