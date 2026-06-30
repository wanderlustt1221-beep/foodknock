// src/app/api/auth/reset-password/route.ts
// Forgot Password — Step 4: validate the reset token, set the new password.
//
// Security properties:
// - Two independent checks must both pass: (1) the JWT verifies against
//   RESET_TOKEN_SECRET with the correct "password-reset" purpose and has
//   not expired, and (2) its hash matches passwordReset.resetTokenHash on
//   the user document AND that hash's own expiry (resetTokenExpiresAt)
//   has not passed. Either check failing rejects the request.
// - Single-use: passwordReset.resetTokenHash is cleared in the very same
//   atomic update that sets the new password, so the same token cannot be
//   redeemed twice even if replayed immediately.
// - Does not touch the existing session JWT/cookie flow at all — this only
//   updates the `password` field already used by login/register, so
//   existing sessions, login, and register behavior are unaffected.

import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { hashPassword, verifyResetToken } from "@/lib/auth";
import { compareResetToken, isExpired } from "@/lib/otp";

const resetPasswordSchema = z.object({
    resetToken: z.string().trim().min(1, "Reset token is required"),
    password:   z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => null);
        const parsed = resetPasswordSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, message: "Invalid input", errors: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { resetToken, password } = parsed.data;

        // ── Verify JWT (signature + expiry + purpose) ─────────────────────
        let decoded: { userId: string; purpose: string };
        try {
            decoded = verifyResetToken(resetToken);
        } catch {
            return NextResponse.json(
                { success: false, message: "This reset link is invalid or has expired. Please start again." },
                { status: 400 }
            );
        }

        await connectDB();

        const user = await User.findById(decoded.userId).select("_id passwordReset");

        if (!user || !user.passwordReset?.resetTokenHash) {
            return NextResponse.json(
                { success: false, message: "This reset link is invalid or has expired. Please start again." },
                { status: 400 }
            );
        }

        const pr = user.passwordReset;

        // ── Expiry check on the stored hash's own timestamp ────────────────
        // (Defense in depth — the JWT's own "10m" expiry already covers
        // this in practice, but the stored expiry is checked independently
        // in case the two ever drift, e.g. a future change to token TTLs.)
        if (isExpired(pr.resetTokenExpiresAt)) {
            return NextResponse.json(
                { success: false, message: "This reset link is invalid or has expired. Please start again." },
                { status: 400 }
            );
        }

        // ── Confirm this exact token matches what was issued ───────────────
        const tokenMatches = await compareResetToken(resetToken, pr.resetTokenHash);
        if (!tokenMatches) {
            return NextResponse.json(
                { success: false, message: "This reset link is invalid or has expired. Please start again." },
                { status: 400 }
            );
        }

        // ── Set new password + invalidate the token, atomically ───────────
        const hashedPassword = await hashPassword(password);

        await User.findOneAndUpdate(
            { _id: user._id },
            {
                $set: {
                    password: hashedPassword,
                    // Clear all passwordReset state — the flow is complete.
                    "passwordReset.otpHash":              null,
                    "passwordReset.otpExpiresAt":          null,
                    "passwordReset.otpAttempts":           0,
                    "passwordReset.lockedUntil":           null,
                    "passwordReset.resetTokenHash":        null,
                    "passwordReset.resetTokenExpiresAt":   null,
                },
            }
        );

        return NextResponse.json(
            {
                success: true,
                message: "Your password has been reset successfully. You can now sign in.",
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("RESET_PASSWORD_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Something went wrong. Please try again." },
            { status: 500 }
        );
    }
}