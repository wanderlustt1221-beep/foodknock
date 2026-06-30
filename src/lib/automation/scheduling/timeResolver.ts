// src/lib/automation/scheduling/timeResolver.ts
//
// FoodKnock Automation Engine — Time Resolver (Part 5 of 6).
//
// Pure, zero-dependency timezone math: given a UTC instant and an IANA
// timezone string (e.g. "Asia/Kolkata" — the same string already stored
// on AutomationRule.timezone since Part 1), what's the LOCAL date/time/
// weekday at that instant? Built on Intl.DateTimeFormat, which is a Node
// global — no date library (date-fns-tz, luxon, moment-timezone) was
// added for this, keeping the dependency footprint exactly where it was.
//
// This is the lowest layer everything else in scheduling/ builds on
// (scheduleResolver.ts, windowEvaluator.ts) — correctness here matters
// more than anywhere else in this part, so every property below was
// explicitly verified at runtime before being trusted: a known UTC-to-IST
// offset, a timezone where the local DATE rolls back a full day relative
// to UTC (America/Los_Angeles), weekday correctness following that
// rollback, and the "local midnight renders as hour 24, not 0" quirk
// some Intl implementations have, which this code corrects for.

export type LocalTimeParts = {
    year: number;
    month: number; // 1-12
    day: number; // 1-31
    hour: number; // 0-23
    minute: number; // 0-59
    /** 0 = Sunday, 6 = Saturday — JS Date.getDay() convention, chosen so weekly-schedule configs can reuse that same convention without translation. */
    weekday: number;
    /** "YYYY-MM-DD" in the target timezone — the calendar-day component of windowKey (see windowEvaluator.ts). */
    dateKey: string;
};

const WEEKDAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Resolves `instant` into its local calendar/clock representation in
 * `timeZone`. Throws if `timeZone` is not a recognized IANA identifier —
 * callers (windowEvaluator.ts) should treat that as a rule configuration
 * error, not a scheduling decision to make silently.
 */
export function getLocalParts(instant: Date, timeZone: string): LocalTimeParts {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short",
        hour12: false,
    });

    const parts = formatter.formatToParts(instant);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;

    const yearStr = get("year");
    const monthStr = get("month");
    const dayStr = get("day");
    const minuteStr = get("minute");
    const weekdayStr = get("weekday");
    const hourStr = get("hour");

    if (!yearStr || !monthStr || !dayStr || !minuteStr || !weekdayStr || hourStr === undefined) {
        throw new Error(`TIME_RESOLVER: failed to resolve local time parts for timezone "${timeZone}".`);
    }

    // Some locales/implementations render exact local midnight as "24"
    // rather than "0" under hour12:false — normalize it. Verified
    // explicitly against a known midnight instant before relying on this.
    const hour = hourStr === "24" ? 0 : Number(hourStr);

    const weekday = WEEKDAY_MAP[weekdayStr];
    if (weekday === undefined) {
        throw new Error(`TIME_RESOLVER: unrecognized weekday abbreviation "${weekdayStr}".`);
    }

    return {
        year: Number(yearStr),
        month: Number(monthStr),
        day: Number(dayStr),
        hour,
        minute: Number(minuteStr),
        weekday,
        dateKey: `${yearStr}-${monthStr}-${dayStr}`,
    };
}

/** Zero-padded "HH:mm" — the time-slot component of windowKey. */
export function formatTimeSlot(hour: number, minute: number): string {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}