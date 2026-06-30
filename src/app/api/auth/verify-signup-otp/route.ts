// src/app/api/auth/verify-signup-otp/route.ts
// Step 2 of the OTP-gated signup flow — the ONLY place a User document is
// created. Verifies the OTP against the PendingSignup record, re-checks
// email/phone uniqueness as a race-condition guard (in case another
// registration completed for the same email/phone while this OTP was
// in flight), creates the User, resolves the referrer, signs the normal
// session JWT, sets the auth cookie (auto-login), and deletes the consumed
// PendingSignup record so the OTP can never be reused.
//
// Same attempt-limit / lockout rules as forgot-password's verify-otp:
// 5 wrong attempts -> 30-minute lock, enforced via atomic updates.
//
// Now also fires the welcome email (fire-and-forget) immediately after a
// successful account creation.

import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import PendingSignup from "@/models/PendingSignup";
import { signToken } from "@/lib/auth";
import { uniqueReferralCode, resolveReferrer } from "@/lib/referral";
import { sendWelcomeEmail } from "@/lib/mailer";
import {
    compareOtp,
    isExpired,
    isLocked,
    lockSecondsRemaining,
    OTP_LOCK_MINUTES,
    OTP_MAX_VERIFY_ATTEMPTS,
} from "@/lib/otp";

const verifySchema = z.object({
    email: z.string().trim().toLowerCase().email("Valid email is required"),
    otp:   z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        const parsed = verifySchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, message: "A valid email and 6-digit code are required." },
                { status: 400 }
            );
        }

        const { email, otp } = parsed.data;

        await connectDB();

        const pending = await PendingSignup.findOne({ email });

        if (!pending || !pending.otpHash) {
            return NextResponse.json(
                { success: false, message: "Invalid or expired code. Please register again." },
                { status: 400 }
            );
        }

        // ── Lock check ─────────────────────────────────────────────────────
        if (isLocked(pending.lockedUntil)) {
            const seconds = lockSecondsRemaining(pending.lockedUntil);
            return NextResponse.json(
                {
                    success: false,
                    message: `Too many incorrect attempts. Please try again in ${Math.ceil(seconds / 60)} minute(s).`,
                },
                { status: 429 }
            );
        }

        // ── Expiry check ───────────────────────────────────────────────────
        if (isExpired(pending.otpExpiresAt)) {
            return NextResponse.json(
                { success: false, message: "This code has expired. Please request a new one." },
                { status: 400 }
            );
        }

        // ── Compare OTP ────────────────────────────────────────────────────
        const matches = await compareOtp(otp, pending.otpHash);

        if (!matches) {
            const nextAttempts = (pending.otpAttempts ?? 0) + 1;
            const hitLimit = nextAttempts >= OTP_MAX_VERIFY_ATTEMPTS;

            await PendingSignup.findOneAndUpdate(
                { _id: pending._id },
                {
                    $set: {
                        otpAttempts: nextAttempts,
                        ...(hitLimit
                            ? { lockedUntil: new Date(Date.now() + OTP_LOCK_MINUTES * 60 * 1000) }
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

        // ── Race-condition guard: re-check uniqueness right before create ─
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            await PendingSignup.deleteOne({ _id: pending._id });
            return NextResponse.json(
                { success: false, message: "Email already exists" },
                { status: 409 }
            );
        }

        const existingPhone = await User.findOne({ phone: pending.phone });
        if (existingPhone) {
            await PendingSignup.deleteOne({ _id: pending._id });
            return NextResponse.json(
                { success: false, message: "Phone number already exists" },
                { status: 409 }
            );
        }

        // ── Resolve referrer (silently ignored if invalid — never blocks
        // account creation; self-referral was already rejected in step 1) ─
        const { referrerId } = await resolveReferrer(pending.referralCodeInput, email);

        // ── Create the account ─────────────────────────────────────────────
        const myReferralCode = await uniqueReferralCode(pending.name);

        const user = await User.create({
            name:                  pending.name,
            ...(pending.dob ? { dob: pending.dob } : {}),
            email,
            phone:                 pending.phone,
            password:              pending.password,
            address:               pending.address,
            referralCode:          myReferralCode,
            referredBy:            referrerId,
            loyaltyPoints:         0,
            referralRewardGranted: false,
            deliveredOrderCount:   0,
            // firstDeliveryFreeUsed is NOT explicitly set here — the schema
            // default of `false` is correct.
        });

        // ── Consume the pending signup — single-use, can never be replayed
        await PendingSignup.deleteOne({ _id: pending._id });

        // ── Welcome email (fire-and-forget — never blocks account creation) ─
        sendWelcomeEmail(user.email, { name: user.name }).catch((err) => {
            console.error("WELCOME_EMAIL_ERROR", err);
        });

        // ── Sign JWT + auto-login ──────────────────────────────────────────
        const token = signToken({
            userId: user._id.toString(),
            email:  user.email,
            role:   user.role,
        });

        const response = NextResponse.json(
            {
                success: true,
                message: "Account created successfully.",
                user: {
                    id:           user._id,
                    name:         user.name,
                    email:        user.email,
                    role:         user.role,
                    referralCode: user.referralCode,
                },
            },
            { status: 201 }
        );

        response.cookies.set("token", token, {
            httpOnly: true,
            secure:   process.env.NODE_ENV === "production",
            sameSite: "lax",
            path:     "/",
            maxAge:   60 * 60 * 24 * 7,
        });

        return response;
    } catch (error) {
        console.error("VERIFY_SIGNUP_OTP_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}