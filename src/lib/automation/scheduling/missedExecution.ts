// src/lib/automation/scheduling/missedExecution.ts
//
// FoodKnock Automation Engine — Missed Execution Recovery (Part 5 of 6).
//
// "If automation should have executed but server was sleeping or
// deployment happened or invocation was missed, system should determine
// whether recovery should happen. Recovery must never generate duplicate
// notifications."
//
// The duplicate-protection half of that requirement is entirely
// executionLimiter.ts's job (the unique-indexed AutomationWindowClaim) —
// a recovered window goes through the EXACT SAME atomic claim as an
// on-time one, so "never generate duplicate notifications" holds
// identically for both cases, not via a second mechanism.
//
// What THIS file adds on top: a POLICY decision windowEvaluator.ts
// deliberately doesn't make — "due and unclaimed" is necessary but not
// sufficient to decide a window is worth recovering. A daily-9am window
// discovered unclaimed at 9:05am should obviously run; one discovered
// unclaimed because the scheduler invocation was simply never set up
// until five days later should NOT suddenly fire a "lunch reminder" at
// a random time, addressed with stale context. The cutoff for "still
// worth it" is a genuine business/operational judgment call — kept here,
// as one explicit, named constant, rather than buried inside
// windowEvaluator.ts's purely mechanical calendar math.

import { resolveDueWindows } from "./windowEvaluator";
import { isWindowClaimed } from "./executionLimiter";
import type { AutomationRuleDefinition } from "../types";
import type { DueWindow } from "./windowEvaluator";

/**
 * How far back an unclaimed window is still considered worth recovering.
 * 24 hours: generous enough to absorb a multi-hour external-cron gap or
 * a same-day deployment window, conservative enough that a marketing
 * notification never fires days late with stale context. A genuine
 * policy choice, not a derived fact — flagged as such rather than
 * presented as the only correct number.
 */
export const DEFAULT_RECOVERY_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export type RecoverableWindow = DueWindow & {
    ruleSlug: string;
    /** True if scheduledAt is more than a few minutes in the past — informational, distinguishes "right on time" from "recovered" in logs/results without changing how either is processed (both go through the identical claim path). */
    isRecovery: boolean;
};

/**
 * Resolves every due window for `rule` (via windowEvaluator.ts, unchanged
 * logic) and filters out any that are EITHER already claimed OR too
 * stale to recover. What's left is exactly what's worth attempting —
 * whether that attempt counts as "on time" or "recovered" is informational
 * only (`isRecovery`), since both paths claim and execute identically.
 */
export async function resolveRecoverableWindows(
    rule: AutomationRuleDefinition,
    now: Date = new Date(),
    lookbackMs: number = DEFAULT_RECOVERY_LOOKBACK_MS
): Promise<RecoverableWindow[]> {
    const dueWindows = resolveDueWindows(rule, now);
    if (dueWindows.length === 0) return [];

    const recoverable: RecoverableWindow[] = [];

    for (const window of dueWindows) {
        // "immediate" schedules have no stable windowKey at all (see
        // windowEvaluator.ts) — there's nothing to claim or recover;
        // every check is its own, ungrouped attempt, paced entirely by
        // the rule's own existing cooldown/frequency.
        if (window.windowKey === null) {
            recoverable.push({ ...window, ruleSlug: rule.slug, isRecovery: false });
            continue;
        }

        const ageMs = now.getTime() - window.scheduledAt.getTime();
        if (ageMs > lookbackMs) continue; // too stale — deliberately abandoned, not recovered

        const alreadyClaimed = await isWindowClaimed(rule.id, window.windowKey);
        if (alreadyClaimed) continue; // already ran (on time or previously recovered) — nothing to do

        recoverable.push({
            ...window,
            ruleSlug: rule.slug,
            isRecovery: ageMs > 5 * 60 * 1000, // more than 5 minutes late — informational threshold only
        });
    }

    return recoverable;
}