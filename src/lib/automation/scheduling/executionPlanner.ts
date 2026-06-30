// src/lib/automation/scheduling/executionPlanner.ts
//
// FoodKnock Automation Engine — Execution Planner (Part 5 of 6).
//
// "Create a planner that decides what should run before running
// anything. Pure planning. No sending." This file calls NOTHING that
// mutates state — no window claims, no Runner calls, no notification
// sends. It composes three existing pieces into one read-only plan:
//   ruleSelector.ts      — which rules are even worth checking
//   ruleEngine.isRuleActiveNow (Parts 1-3, unchanged) — still inside its
//                          activation window?
//   missedExecution.ts   — does it have a due-and-unclaimed window
//                          (recovered or on-time, doesn't matter here)?
//
// This separation is what makes a genuine, side-effect-free preview
// possible (runnerApi.ts's previewRule()) — "what WOULD run right now"
// is answerable without anything claiming a window or calling the
// Runner, which matters because checking is something you might want to
// do far more often than actually executing (e.g. an admin tool polling
// "what's about to fire" every few seconds would be actively harmful if
// each check itself claimed windows).

import { selectSchedulableRules } from "./ruleSelector";
import { isRuleActiveNow } from "../ruleEngine";
import { resolveRecoverableWindows, DEFAULT_RECOVERY_LOOKBACK_MS } from "./missedExecution";
import type { RecoverableWindow } from "./missedExecution";
import type { AutomationRuleDefinition } from "../types";

export type PlannedExecution = {
    rule: AutomationRuleDefinition;
    window: RecoverableWindow;
};

export type ExecutionPlan = {
    plannedAt: Date;
    /** Every rule selectSchedulableRules() returned, regardless of whether anything was ultimately planned for it — useful for previewRule()'s "why ISN'T this rule planned" diagnostics. */
    rulesConsidered: number;
    executions: PlannedExecution[];
};

/**
 * Builds the full plan: every (rule, window) pair that's currently due,
 * unclaimed, and within an active window, across every schedulable rule.
 * Read-only — see file header. Callers (runnerApi.ts) decide what to do
 * with the plan; this function never acts on it.
 */
export async function planDueExecutions(
    now: Date = new Date(),
    lookbackMs: number = DEFAULT_RECOVERY_LOOKBACK_MS
): Promise<ExecutionPlan> {
    const rules = await selectSchedulableRules();
    const executions: PlannedExecution[] = [];

    for (const rule of rules) {
        if (!isRuleActiveNow(rule, now)) continue;

        const windows = await resolveRecoverableWindows(rule, now, lookbackMs);
        for (const window of windows) {
            executions.push({ rule, window });
        }
    }

    return { plannedAt: now, rulesConsidered: rules.length, executions };
}

/** Plans for exactly one rule (by already-loaded definition) — used by runnerApi.ts's previewRule() so a single-rule preview doesn't need to load and check every OTHER schedulable rule too. */
export async function planForRule(
    rule: AutomationRuleDefinition,
    now: Date = new Date(),
    lookbackMs: number = DEFAULT_RECOVERY_LOOKBACK_MS
): Promise<PlannedExecution[]> {
    if (!isRuleActiveNow(rule, now)) return [];
    const windows = await resolveRecoverableWindows(rule, now, lookbackMs);
    return windows.map((window) => ({ rule, window }));
}