// src/components/shared/notificationReminder.ts
//
// FoodKnock — Permission Reminder Logic (Feature 3, Part 5).
//
// "Show again after several visits, not every page. Remember dismissal."
// This is pure, storage-touching logic kept out of the component so the
// schedule rule itself (which visit numbers trigger a re-show) is easy to
// read and change without wading through JSX.
//
// Uses localStorage (not sessionStorage, which the original Phase 0
// component used) because "show again after several visits" inherently
// needs to survive across browser sessions — sessionStorage is cleared
// the moment the tab/browser closes, which would make every visit look
// like visit #1 again.
//
// "Visit" granularity: NotificationPrompt is mounted once in the root
// layout and persists across client-side route navigations without
// remounting, so incrementing the counter once per mount already gives
// exactly "once per full page load / hard navigation" — the right
// granularity for "visit 3, visit 7", not "click 3, click 7".

const VISIT_COUNT_KEY = "fk_notif_visit_count";
const DISMISSED_AT_KEY = "fk_notif_dismissed_at";

/** Specific early visits to show on, then every Nth visit after the last one. */
const REMINDER_VISITS = [3, 7, 12];
const REMINDER_INTERVAL_AFTER_LAST = 15;

function safeGet(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeSet(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Storage unavailable (private browsing, quota, etc.) — the prompt
        // simply won't be reminder-paced this session; it degrades to "may
        // show every visit" rather than throwing, which is an acceptable,
        // rare degradation rather than a hard failure.
    }
}

/** Increments and returns the visit counter. Call once per mount. */
export function recordVisit(): number {
    const current = Number(safeGet(VISIT_COUNT_KEY) ?? "0") || 0;
    const next = current + 1;
    safeSet(VISIT_COUNT_KEY, String(next));
    return next;
}

/** Whether this visit number is one of the scheduled reminder points. */
export function shouldShowOnVisit(visitCount: number): boolean {
    if (REMINDER_VISITS.includes(visitCount)) return true;
    const last = REMINDER_VISITS[REMINDER_VISITS.length - 1];
    return visitCount > last && (visitCount - last) % REMINDER_INTERVAL_AFTER_LAST === 0;
}

/** Records that the user dismissed the sheet — informational, for future tuning. */
export function markDismissed(): void {
    safeSet(DISMISSED_AT_KEY, String(Date.now()));
}
