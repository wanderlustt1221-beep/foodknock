// src/components/shared/notificationPromptSession.ts
//
// FoodKnock — Notification Prompt Session Tracking.
//
// Rule: show the prompt once per browser SESSION until permission is
// "granted". Dismissing hides it for the current session only.
// Closing and reopening the browser clears sessionStorage automatically,
// giving every new visit a fresh chance — no manual reset needed.
//
// notificationReminder.ts has been removed. This file fully replaces it.

const SHOWN_THIS_SESSION_KEY     = "fk_notif_shown_this_session";
const DISMISSED_THIS_SESSION_KEY = "fk_notif_dismissed_this_session";

function safeGet(key: string): string | null {
    try {
        return sessionStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeSet(key: string, value: string): void {
    try {
        sessionStorage.setItem(key, value);
    } catch {
        // Unavailable (private browsing, quota) — degrades to "may show
        // again within the same session" rather than throwing.
    }
}

/**
 * Whether the prompt is still eligible to show THIS session.
 * Returns false once it's been shown OR dismissed this session.
 * Returns true again on every fresh session (browser closed/reopened).
 */
export function isEligibleThisSession(): boolean {
    return (
        safeGet(SHOWN_THIS_SESSION_KEY)     === null &&
        safeGet(DISMISSED_THIS_SESSION_KEY) === null
    );
}

/** Call the moment the prompt becomes visible. Prevents a second show within the same session. */
export function markShownThisSession(): void {
    safeSet(SHOWN_THIS_SESSION_KEY, "1");
}

/** Call when the user dismisses the prompt. Hides it for the rest of THIS session only. */
export function markDismissedThisSession(): void {
    safeSet(DISMISSED_THIS_SESSION_KEY, "1");
}