// src/lib/loginSecurity.ts
// Pure helper functions for login brute-force protection — mirrors the
// style of src/lib/otp.ts. No DB or HTTP side effects except getClientIp,
// which only reads request headers (no I/O).

export const EMAIL_MAX_FAILED_ATTEMPTS = 5;
export const EMAIL_LOCK_MINUTES        = 30;

export const IP_MAX_FAILED_ATTEMPTS    = 20;
export const IP_WINDOW_MINUTES         = 60;
export const IP_BLOCK_MINUTES          = 60;

/**
 * Returns true if the given lock/block timestamp is still in the future.
 */
export function isLocked(lockedUntil: Date | null | undefined): boolean {
    if (!lockedUntil) return false;
    return lockedUntil.getTime() > Date.now();
}

/**
 * Minutes remaining until a lock/block expires (0 if not locked). Rounded
 * up so a 1-second-remaining lock still reports "1 minute", never "0".
 */
export function lockMinutesRemaining(lockedUntil: Date | null | undefined): number {
    if (!isLocked(lockedUntil)) return 0;
    return Math.ceil((lockedUntil!.getTime() - Date.now()) / 60000);
}

/**
 * Determines whether the IP's hourly failure window should reset. A window
 * resets once IP_WINDOW_MINUTES have elapsed since it began.
 */
export function shouldResetIpWindow(windowStart: Date | null | undefined): boolean {
    if (!windowStart) return true;
    const elapsedMs = Date.now() - windowStart.getTime();
    return elapsedMs > IP_WINDOW_MINUTES * 60 * 1000;
}

/**
 * Extracts the best-effort client IP from a request, correctly handling
 * Vercel's forwarded-header conventions:
 *   - x-forwarded-for: "client, proxy1, proxy2" — take the first entry.
 *   - x-real-ip: single-IP fallback some proxies set instead.
 *   - "unknown": stable fallback for local/dev requests with neither header,
 *     so the function never returns null/undefined and never throws.
 */
export function getClientIp(req: Request): string {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) {
        const first = forwardedFor.split(",")[0]?.trim();
        if (first) return first;
    }

    const realIp = req.headers.get("x-real-ip");
    if (realIp?.trim()) return realIp.trim();

    return "unknown";
}