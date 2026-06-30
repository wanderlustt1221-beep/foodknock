// src/lib/automation/frequencyLimiter.ts
//
// FoodKnock Automation Engine — frequency limit gate (Part 1 of 6).
//
// Count-based limiting (hour/day/week/month), distinct from cooldown.ts's
// single-timestamp gating. A rule might allow firing again after a 6-hour
// cooldown but still cap total sends at maxPerDay — these are two
// independent constraints, checked independently by engine.ts.
//
// Window-reset logic mirrors the EXISTING pattern in src/lib/otp.ts
// (shouldResetRequestWindow, used by forgot-password/register rate
// limiting) — not a new convention introduced here. A window is
// "expired" once its duration has elapsed since windowStart; an expired
// window's count is treated as 0 for gating purposes (the actual reset
// write happens in engine.ts's recordExecutionForUser, not here — this
// module is read-only, same separation of concerns as cooldown.ts).
//
// Read-only: never writes to AutomationUserState. See cooldown.ts's
// header for why the read/write split matters.

import type { AutomationGateResult } from "./types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS; // rolling 30 days, not calendar-month — simpler, no month-boundary edge cases

export type FrequencyState = {
    hourlyCount: number;
    hourlyWindowStart: Date | null;
    dailyCount: number;
    dailyWindowStart: Date | null;
    weeklyCount: number;
    weeklyWindowStart: Date | null;
    monthlyCount: number;
    monthlyWindowStart: Date | null;
    /** Part 2: running total, never resets — see checkFrequencyLimit's maxLifetime. */
    lifetimeCount: number;
};

export type FrequencyLimits = {
    maxPerHour?: number | null;
    maxPerDay?: number | null;
    /** Reserved for future per-week rule limits — not a current AutomationRule field, but the limiter already supports it so adding one later is additive. */
    maxPerWeek?: number | null;
    /** Reserved for future global (cross-rule) limits — see AutomationUserState's top-level counters. */
    maxPerMonth?: number | null;
    /** Part 2: total sends ever, no window. */
    maxLifetime?: number | null;
};

/** Effective count for a window: 0 if the window has expired (or never started), otherwise the stored count. */
function effectiveCount(count: number, windowStart: Date | null, windowMs: number, now: Date): number {
    if (!windowStart) return 0;
    const elapsed = now.getTime() - windowStart.getTime();
    return elapsed >= windowMs ? 0 : count;
}

/**
 * Checks every limit that's actually set on `limits` (undefined/null limits
 * are simply not enforced — a rule with no maxPerHour has no hourly cap).
 * Returns the first failing limit's reason, or allowed:true if all pass.
 */
export function checkFrequencyLimit(
    limits: FrequencyLimits,
    state: FrequencyState | undefined,
    now: Date = new Date()
): AutomationGateResult {
    const safe: FrequencyState = state ?? {
        hourlyCount: 0,
        hourlyWindowStart: null,
        dailyCount: 0,
        dailyWindowStart: null,
        weeklyCount: 0,
        weeklyWindowStart: null,
        monthlyCount: 0,
        monthlyWindowStart: null,
        lifetimeCount: 0,
    };

    if (typeof limits.maxPerHour === "number") {
        const count = effectiveCount(safe.hourlyCount, safe.hourlyWindowStart, HOUR_MS, now);
        if (count >= limits.maxPerHour) {
            return { allowed: false, reason: `Hourly limit reached (${limits.maxPerHour}/hour).` };
        }
    }

    if (typeof limits.maxPerDay === "number") {
        const count = effectiveCount(safe.dailyCount, safe.dailyWindowStart, DAY_MS, now);
        if (count >= limits.maxPerDay) {
            return { allowed: false, reason: `Daily limit reached (${limits.maxPerDay}/day).` };
        }
    }

    if (typeof limits.maxPerWeek === "number") {
        const count = effectiveCount(safe.weeklyCount, safe.weeklyWindowStart, WEEK_MS, now);
        if (count >= limits.maxPerWeek) {
            return { allowed: false, reason: `Weekly limit reached (${limits.maxPerWeek}/week).` };
        }
    }

    if (typeof limits.maxPerMonth === "number") {
        const count = effectiveCount(safe.monthlyCount, safe.monthlyWindowStart, MONTH_MS, now);
        if (count >= limits.maxPerMonth) {
            return { allowed: false, reason: `Monthly limit reached (${limits.maxPerMonth}/month).` };
        }
    }

    if (typeof limits.maxLifetime === "number") {
        if (safe.lifetimeCount >= limits.maxLifetime) {
            return { allowed: false, reason: `Lifetime limit reached (${limits.maxLifetime} total).` };
        }
    }

    return { allowed: true };
}

/**
 * Computes the next value for one counter, given whether its window has
 * expired. Exported so engine.ts's write-side (recordExecutionForUser)
 * can reuse the exact same window logic this module uses to CHECK limits
 * — the read and write sides must agree on what "expired" means, or a
 * count could reset inconsistently between a check and a write.
 */
export function nextWindowState(
    count: number,
    windowStart: Date | null,
    windowMs: number,
    now: Date
): { count: number; windowStart: Date } {
    if (!windowStart || now.getTime() - windowStart.getTime() >= windowMs) {
        return { count: 1, windowStart: now };
    }
    return { count: count + 1, windowStart };
}

export const FREQUENCY_WINDOW_MS = { HOUR_MS, DAY_MS, WEEK_MS, MONTH_MS };

// ── Part 2: multi-dimensional strategy composition ────────────────────────
//
// "Design extensible strategy pattern" — each dimension (rule, category,
// campaign, global) is a "strategy": a (limits, state) pair checked via
// the EXACT SAME checkFrequencyLimit() above. This function doesn't
// reimplement any counting/window logic — it just calls that one
// function multiple times and returns the first dimension that fails.
// Adding a new dimension later (e.g. "per-device") means adding one more
// entry to the `dimensions` array below — no change to checkFrequencyLimit
// itself, and no change to any existing dimension's behavior.

export type FrequencyDimension = {
    name: "rule" | "category" | "campaign" | "global";
    limits: FrequencyLimits;
    state: FrequencyState | undefined;
};

export function checkAllFrequencyLimits(
    dimensions: FrequencyDimension[],
    now: Date = new Date()
): AutomationGateResult {
    for (const dimension of dimensions) {
        const result = checkFrequencyLimit(dimension.limits, dimension.state, now);
        if (!result.allowed) {
            return { allowed: false, reason: `[${dimension.name}] ${result.reason}` };
        }
    }
    return { allowed: true };
}