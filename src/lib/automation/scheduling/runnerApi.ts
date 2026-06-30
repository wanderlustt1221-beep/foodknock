// src/lib/automation/scheduling/runnerApi.ts
//
// FoodKnock Automation Engine — Runner API (Part 5 of 6).
//
// "Create one clean public API for triggering automation externally...
// The API should never expose internal implementation." This is that
// facade — runDueAutomations(), runRuleNow(), previewRule(), dryRun().
// Whatever eventually calls this (a future API route hit by Vercel Cron,
// GitHub Actions, EasyCron, cron-job.org, Railway Cron, or a manual admin
// action) never needs to know about windows, claims, schedule resolvers,
// or any of scheduling/'s internals — only these four functions.
//
// The chain this preserves, unbroken, exactly as every prior part:
//   Scheduler (this file) → Runner (Part 4, runBatch/runOne, REUSED) →
//   Automation Engine (Parts 1-3, REUSED) → Notification Engine → Providers
//
// ── ONE IMPORTANT, DELIBERATE BEHAVIOR ────────────────────────────────────
// If a single rule has MULTIPLE due-and-unclaimed windows at once (e.g.
// a multiple_times_per_day rule discovered after a long gap, with two
// slots both overdue), every window is still claimed individually (so
// neither is ever rediscovered as unclaimed later) — but the rule itself
// is only EXECUTED ONCE. Running it twice back-to-back would mean
// sending the same marketing content to the same users twice in a row
// purely because of a scheduling gap, which defeats the entire point of
// careful frequency/cooldown management elsewhere in this system. All
// claimed windows for that rule are marked with the single execution's
// shared outcome.
//
// ── VERCEL HOBBY: A TIME BUDGET, NOT AN UNBOUNDED LOOP ───────────────────
// runDueAutomations() stops CLAIMING further NEW rules once its time
// budget is spent, rather than risking a serverless function timeout
// mid-run. Anything not reached this tick simply stays due, unclaimed —
// the NEXT external cron invocation picks it up for free, with zero
// special "resume" logic needed (this is the exact same "open until
// claimed" property missedExecution.ts already relies on for recovery).

import { planDueExecutions, planForRule } from "./executionPlanner";
import { claimWindow, markWindowOutcome } from "./executionLimiter";
import type { WindowClaim } from "./executionLimiter";
import { loadRule } from "../ruleEngine";
import { runner } from "../runner";
import type { RunnerExecutionResult } from "../runner";

const DEFAULT_MAX_DURATION_MS = 8000; // conservative default well under typical serverless function limits

export type RunDueAutomationsOptions = {
    /** Stop claiming further new rules once this much time has elapsed. Already-claimed rules in the current batch still finish. Default 8000ms. */
    maxDurationMs?: number;
    now?: Date;
};

export type RunDueAutomationsResult = {
    rulesConsidered: number;
    rulesClaimed: number;
    rulesSkippedAlreadyClaimed: number;
    timeBudgetExceeded: boolean;
    results: RunnerExecutionResult[];
};

/**
 * The function an external cron source calls. Plans, claims, executes —
 * the one entry point that actually moves automation rules forward on a
 * schedule, with zero scheduling mechanism of its own (see file header).
 */
export async function runDueAutomations(options?: RunDueAutomationsOptions): Promise<RunDueAutomationsResult> {
    const startedAt = Date.now();
    const maxDurationMs = options?.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
    const now = options?.now ?? new Date();

    const plan = await planDueExecutions(now);

    // Group planned windows by rule — see file header for why a rule
    // with several due windows still executes only once.
    const windowsByRuleSlug = new Map<string, { ruleId: string; ruleSlug: string; windowKeys: (string | null)[] }>();
    for (const { rule, window } of plan.executions) {
        const entry = windowsByRuleSlug.get(rule.slug) ?? { ruleId: rule.id, ruleSlug: rule.slug, windowKeys: [] };
        entry.windowKeys.push(window.windowKey);
        windowsByRuleSlug.set(rule.slug, entry);
    }

    const claimedRuleSlugs: string[] = [];
    const claimsByRuleSlug = new Map<string, WindowClaim[]>();
    let rulesSkippedAlreadyClaimed = 0;
    let timeBudgetExceeded = false;

    for (const [ruleSlug, entry] of windowsByRuleSlug) {
        if (Date.now() - startedAt > maxDurationMs) {
            timeBudgetExceeded = true;
            break; // remaining rules stay due/unclaimed — the next tick picks them up, nothing lost
        }

        const claims: WindowClaim[] = [];
        for (const windowKey of entry.windowKeys) {
            if (windowKey === null) continue; // "immediate" — nothing to claim, see file header
            const claim = await claimWindow(entry.ruleId, ruleSlug, windowKey);
            if (claim) claims.push(claim);
        }

        const hasImmediateWindow = entry.windowKeys.includes(null);
        if (claims.length > 0 || hasImmediateWindow) {
            claimedRuleSlugs.push(ruleSlug);
            claimsByRuleSlug.set(ruleSlug, claims);
        } else {
            rulesSkippedAlreadyClaimed++;
        }
    }

    const results = claimedRuleSlugs.length > 0
        ? await runner.runBatch({ ruleSlugs: claimedRuleSlugs, initiatedBy: "scheduler" }, undefined, "scheduled")
        : [];

    // Mark every claimed window with its rule's single execution outcome.
    for (const result of results) {
        const ruleSlug = result.automationResult?.ruleSlug;
        if (!ruleSlug) continue;
        const claims = claimsByRuleSlug.get(ruleSlug) ?? [];
        const outcome: "completed" | "failed" = result.runnerError || result.automationResult?.status === "failed" ? "failed" : "completed";
        for (const claim of claims) {
            await markWindowOutcome(claim, outcome, result.context.executionId);
        }
    }

    return {
        rulesConsidered: plan.rulesConsidered,
        rulesClaimed: claimedRuleSlugs.length,
        rulesSkippedAlreadyClaimed,
        timeBudgetExceeded,
        results,
    };
}

/**
 * Manual override — runs `ruleSlug` immediately, bypassing window
 * discovery and claiming entirely. This is the explicit, intentional
 * one-off the brief's own "Manual Admin Trigger" trigger source
 * describes — by definition it ignores the rule's schedule, so it has
 * no window to claim. Delegates straight to runner.runOne() (Part 4).
 */
export async function runRuleNow(ruleSlug: string, initiatedBy?: string): Promise<RunnerExecutionResult> {
    return runner.runOne({ ruleSlug, initiatedBy }, undefined);
}

export type PreviewResult = {
    ruleSlug: string;
    ruleFound: boolean;
    wouldExecute: boolean;
    plannedWindows: Array<{ windowKey: string | null; isRecovery: boolean }>;
};

/** "If the scheduler ran right now, would THIS rule fire, and for which window?" — zero side effects, see executionPlanner.ts's header for why that matters. */
export async function previewRule(ruleSlug: string, now?: Date): Promise<PreviewResult> {
    const rule = await loadRule(ruleSlug);
    if (!rule) {
        return { ruleSlug, ruleFound: false, wouldExecute: false, plannedWindows: [] };
    }

    const planned = await planForRule(rule, now);
    return {
        ruleSlug,
        ruleFound: true,
        wouldExecute: planned.length > 0,
        plannedWindows: planned.map((p) => ({ windowKey: p.window.windowKey, isRecovery: p.window.isRecovery })),
    };
}

/** Full pipeline preview through content-selection, without ever delivering anything or writing to any model — delegates entirely to the EXISTING dry-run support built in Part 4/the Automation Engine. */
export async function dryRun(ruleSlug: string, initiatedBy?: string): Promise<RunnerExecutionResult> {
    return runner.runOne({ ruleSlug, initiatedBy, dryRun: true }, undefined);
}