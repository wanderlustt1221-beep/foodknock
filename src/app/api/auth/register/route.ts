// src/app/api/auth/register/route.ts
// Step 1 of the OTP-gated signup flow.
//
// IMPORTANT: this route no longer creates a User. It validates input,
// checks for duplicate email/phone against existing Users, runs the
// self-referral guard, stores the registration data (with an already-
// hashed password) in a PendingSignup record, and emails the first OTP.
//
// The actual User document is created only in verify-signup-otp, after the
// OTP is successfully verified — see that route for account creation,
// referrer resolution, and auto-login.
//
// Rate limiting (60s resend cooldown, 5 requests/hour) is enforced here via
// the same atomic-update pattern used by the forgot-password flow, since a
// user can resubmit this form multiple times before completing OTP
// verification.

import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import PendingSignup from "@/models/PendingSignup";
import { hashPassword } from "@/lib/auth";
import { resolveReferrer } from "@/lib/referral";
import { sendSignupOtpEmail } from "@/lib/mailer";
import { notificationEngine } from "@/lib/notifications";
import { buildOtpRequestedPayload } from "@/lib/notifications/transactionalTemplates";
import {
    generateOtp,
    hashOtp,
    OTP_EXPIRY_MINUTES,
    OTP_MAX_REQUESTS_PER_HOUR,
    OTP_RESEND_COOLDOWN_SECONDS,
    shouldResetRequestWindow,
} from "@/lib/otp";

// ── Validation ─────────────────────────────────────────────────────────────
const registerSchema = z.object({
    name:         z.string().trim().min(2, "Name must be at least 2 characters"),
    dob:          z.string().trim().optional(),
    email:        z.string().trim().toLowerCase().email("Valid email is required"),
    phone:        z.string().trim().min(10, "Phone number must be at least 10 digits"),
    password:     z.string().min(6, "Password must be at least 6 characters"),
    referralCode: z.string().trim().toUpperCase().optional(),
    address: z.object({
        line1:    z.string().trim().optional().default(""),
        line2:    z.string().trim().optional().default(""),
        city:     z.string().trim().optional().default(""),
        state:    z.string().trim().optional().default(""),
        pincode:  z.string().trim().optional().default(""),
        landmark: z.string().trim().optional().default(""),
    }),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const normalizedBody = {
            name:         body?.name         ?? body?.fullName    ?? "",
            dob:          body?.dob          ?? body?.dateOfBirth ?? "",
            email:        body?.email        ?? "",
            phone:        String(body?.phone ?? body?.mobile      ?? "").trim(),
            password:     body?.password     ?? "",
            referralCode: body?.referralCode ?? body?.inviteCode  ?? "",
            address: {
                line1:    body?.address?.line1    ?? body?.line1    ?? "",
                line2:    body?.address?.line2    ?? body?.line2    ?? "",
                city:     body?.address?.city     ?? body?.city     ?? "",
                state:    body?.address?.state    ?? body?.state    ?? "",
                pincode:  body?.address?.pincode  ?? body?.pincode  ?? "",
                landmark: body?.address?.landmark ?? body?.landmark ?? "",
            },
        };

        const parsed = registerSchema.safeParse(normalizedBody);
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, message: "Invalid input", errors: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const email = parsed.data.email.toLowerCase();

        await connectDB();

        // ── Duplicate email check (against real Users) ────────────────────
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { success: false, message: "Email already exists" },
                { status: 409 }
            );
        }

        // ── Duplicate phone check (against real Users) ────────────────────
        const existingPhone = await User.findOne({ phone: parsed.data.phone });
        if (existingPhone) {
            return NextResponse.json(
                { success: false, message: "Phone number already exists" },
                { status: 409 }
            );
        }

        // ── Self-referral guard (fail fast, before spending an OTP) ──────
        if (parsed.data.referralCode) {
            const { selfReferralAttempted } = await resolveReferrer(parsed.data.referralCode, email);
            if (selfReferralAttempted) {
                return NextResponse.json(
                    { success: false, message: "You cannot use your own referral code." },
                    { status: 400 }
                );
            }
        }

        // ── Hash password now — never store plaintext, even temporarily ──
        const hashedPassword = await hashPassword(parsed.data.password);

        // ── Look up any existing pending signup for this email ───────────
        const existingPending = await PendingSignup.findOne({ email }).select(
            "lastRequestedAt requestCount requestWindowStart"
        );

        if (existingPending?.lastRequestedAt) {
            const elapsedMs = Date.now() - existingPending.lastRequestedAt.getTime();
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

        const resetWindow = shouldResetRequestWindow(existingPending?.requestWindowStart ?? null);
        const currentCount = resetWindow ? 0 : (existingPending?.requestCount ?? 0);

        if (!resetWindow && currentCount >= OTP_MAX_REQUESTS_PER_HOUR) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Too many verification code requests. Please try again in an hour.",
                },
                { status: 429 }
            );
        }

        // ── Generate + hash OTP ───────────────────────────────────────────
        const otp = generateOtp();
        const otpHash = await hashOtp(otp);
        const now = new Date();
        const otpExpiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);

        // ── Upsert the pending signup (replaces any prior attempt for this
        // email — e.g. the user corrected a field and resubmitted) ───────
        await PendingSignup.findOneAndUpdate(
            { email },
            {
                $set: {
                    name:               parsed.data.name,
                    dob:                parsed.data.dob || undefined,
                    phone:              parsed.data.phone,
                    password:           hashedPassword,
                    referralCodeInput:  parsed.data.referralCode || "",
                    address:            parsed.data.address,
                    otpHash,
                    otpExpiresAt,
                    otpAttempts:        0,
                    lockedUntil:        null,
                    requestCount:       currentCount + 1,
                    requestWindowStart: resetWindow ? now : (existingPending?.requestWindowStart ?? now),
                    lastRequestedAt:    now,
                },
            },
            { upsert: true, setDefaultsOnInsert: true }
        );

        // ── Send the verification email ────────────────────────────────────
        try {
            await sendSignupOtpEmail({ to: email, name: parsed.data.name, otp });
        } catch (emailError) {
            console.error("SIGNUP_OTP_EMAIL_ERROR", emailError);
            return NextResponse.json(
                { success: false, message: "Couldn't send the verification email. Please try again." },
                { status: 500 }
            );
        }

        // ── Also send the OTP via WhatsApp (signup flow only) ───────────────
        // Fire-and-forget, exactly like verify-signup-otp's welcome email —
        // WhatsApp delivery is additive on top of the required, already-
        // working email OTP above; a WhatsApp failure (missing template
        // approval, API outage, unrecognizable phone format, etc.) must
        // never block signup, since the user can always verify via the
        // email code regardless.
        //
        // Uses the engine's DIRECT send() path, not emit() — auth.otp_requested
        // is a transactional event, and the engine's own emit() → handleEvent()
        // safety rail drops any transactional event with no target.userId
        // (see notifications/engine.ts). No User document exists yet at this
        // point in the signup flow (see this file's own header comment) — so
        // emit() would silently drop the event before it ever reached a
        // provider. send() is the engine's other, equally-documented public
        // entry point, built exactly for "caller already has a fully-built
        // payload" — still the same Notification Engine, just its other door.
        //
        // The phone/name fields below are read directly by
        // WhatsAppDeliveryProvider for this one case (no User to resolve via
        // target.userId yet) — see that provider's own send() for the
        // matching, narrowly-scoped branch. Reuses buildOtpRequestedPayload
        // (now exported from transactionalTemplates.ts) rather than
        // constructing a second, duplicate payload shape by hand.
        const whatsappPayload = buildOtpRequestedPayload({
            name: "auth.otp_requested",
            data: { otp, flow: "signup", phone: parsed.data.phone, name: parsed.data.name },
        });
        notificationEngine.send(["whatsapp"], {}, whatsappPayload).catch((whatsappError) => {
            console.error("SIGNUP_OTP_WHATSAPP_ERROR", whatsappError);
        });

        return NextResponse.json(
            {
                success: true,
                message: "Verification code sent to your email.",
                email,
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        console.error("REGISTER_ERROR", error);
        const msg = error instanceof Error ? error.message : "Something went wrong";
        return NextResponse.json(
            { success: false, message: msg },
            { status: 500 }
        );
    }
}
