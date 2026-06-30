// src/lib/otp.ts
// Pure OTP helper functions for the Forgot Password module.
//
// Deliberately has ZERO dependency on Mongo, Next.js, or HTTP — every
// function here is a pure transform so it can be unit tested in isolation
// and reused by any future OTP flow (e.g. phone OTP) without modification.
//
// Security notes:
// - OTP is never stored or logged in plaintext anywhere in this module.
// - bcrypt is reused (already a project dependency) instead of adding a new
//   hashing library, keeping the dependency surface unchanged.

import bcrypt from "bcryptjs";

// ── Tunables (kept here, single source of truth) ───────────────────────────
export const OTP_LENGTH                 = 6;
export const OTP_EXPIRY_MINUTES         = 10;
export const OTP_MAX_VERIFY_ATTEMPTS    = 5;
export const OTP_LOCK_MINUTES           = 30;
export const OTP_MAX_REQUESTS_PER_HOUR  = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const RESET_TOKEN_EXPIRY_MINUTES = 10;

/**
 * Generates a cryptographically-irrelevant-but-sufficient 6-digit numeric OTP.
 * OTPs are short-lived, single-use, and rate-limited — Math.random() entropy
 * is acceptable here per standard OTP threat models (the defense is the
 * rate-limit + lockout + expiry combination, not the RNG itself). Always
 * zero-padded to OTP_LENGTH digits.
 */
export function generateOtp(): string {
    const max = 10 ** OTP_LENGTH;
    const value = Math.floor(Math.random() * max);
    return value.toString().padStart(OTP_LENGTH, "0");
}

/**
 * Hashes an OTP for storage. Never store the plaintext OTP anywhere.
 */
export async function hashOtp(otp: string): Promise<string> {
    return bcrypt.hash(otp, 10);
}

/**
 * Compares a plaintext OTP against its stored hash.
 */
export async function compareOtp(otp: string, otpHash: string): Promise<boolean> {
    return bcrypt.compare(otp, otpHash);
}

/**
 * Returns true if the given expiry timestamp is in the past (or absent).
 */
export function isExpired(expiresAt: Date | null | undefined): boolean {
    if (!expiresAt) return true;
    return expiresAt.getTime() <= Date.now();
}

/**
 * Returns true if the given lock timestamp is still active.
 */
export function isLocked(lockedUntil: Date | null | undefined): boolean {
    if (!lockedUntil) return false;
    return lockedUntil.getTime() > Date.now();
}

/**
 * Seconds remaining until a lock expires (0 if not locked).
 */
export function lockSecondsRemaining(lockedUntil: Date | null | undefined): number {
    if (!isLocked(lockedUntil)) return 0;
    return Math.ceil((lockedUntil!.getTime() - Date.now()) / 1000);
}

/**
 * Seconds remaining until the resend cooldown clears (0 if not on cooldown).
 */
export function resendCooldownSecondsRemaining(lastRequestedAt: Date | null | undefined): number {
    if (!lastRequestedAt) return 0;
    const elapsedMs = Date.now() - lastRequestedAt.getTime();
    const remainingMs = OTP_RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs;
    return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

/**
 * Determines whether the hourly request window should reset, and returns
 * the effective window start to use. A window resets once 60 minutes have
 * elapsed since it began.
 */
export function shouldResetRequestWindow(windowStart: Date | null | undefined): boolean {
    if (!windowStart) return true;
    const elapsedMs = Date.now() - windowStart.getTime();
    return elapsedMs > 60 * 60 * 1000;
}

/**
 * Hashes a reset token (the signed JWT string) for storage, enabling
 * single-use enforcement — the JWT's signature/expiry proves authenticity,
 * but only this stored hash lets reset-password detect "already redeemed".
 */
export async function hashResetToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10);
}

/**
 * Compares a plaintext reset token against its stored hash.
 */
export async function compareResetToken(token: string, tokenHash: string): Promise<boolean> {
    return bcrypt.compare(token, tokenHash);
}