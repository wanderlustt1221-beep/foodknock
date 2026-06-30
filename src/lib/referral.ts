// src/lib/referral.ts
// Shared referral-code helpers — extracted from the original register
// route so account creation (now happening in verify-signup-otp, after OTP
// success) and any future caller can reuse the exact same logic without
// duplication.

import User from "@/models/User";

// ── Referral code generator ────────────────────────────────────────────────
export function generateReferralCode(name: string): string {
    const prefix = name.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3) || "USR";
    const suffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
    return `${prefix}${suffix}`.slice(0, 8).padEnd(8, "X");
}

export async function uniqueReferralCode(name: string): Promise<string> {
    let code     = generateReferralCode(name);
    let attempts = 0;
    while (await User.exists({ referralCode: code })) {
        code = generateReferralCode(name + attempts++);
    }
    return code;
}

/**
 * Resolves a referral code input to a referrer's ObjectId string, applying
 * the self-referral guard (by email match) along the way.
 *
 * - Unknown/mistyped codes are silently ignored — registration is never
 *   blocked over a bad referral code (matches the original behavior).
 * - A self-referral attempt returns a distinct error so the caller can
 *   reject the request before any account is created or any OTP is spent.
 */
export async function resolveReferrer(
    referralCodeInput: string | undefined,
    registrantEmail: string
): Promise<{ referrerId: string | null; selfReferralAttempted: boolean }> {
    if (!referralCodeInput) {
        return { referrerId: null, selfReferralAttempted: false };
    }

    const referrer = await User.findOne({
        referralCode: referralCodeInput.toUpperCase(),
    }).select("_id email");

    if (!referrer) {
        return { referrerId: null, selfReferralAttempted: false };
    }

    if (referrer.email.toLowerCase() === registrantEmail.toLowerCase()) {
        return { referrerId: null, selfReferralAttempted: true };
    }

    return { referrerId: referrer._id.toString(), selfReferralAttempted: false };
}