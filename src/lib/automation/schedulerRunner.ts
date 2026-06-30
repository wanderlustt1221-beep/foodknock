// src/lib/automation/schedulerRunner.ts
//
// FoodKnock Automation Engine — SchedulerRunner (Part 3 of 6).
//
// "The Scheduler is STILL NOT a cron... Build a SchedulerRunner
// abstraction... The future cron implementation will simply call these
// methods." This file is exactly that abstraction — genuinely a NEW file
// (no existing Part 1/2 module has "find due rules and run them" as a
// responsibility), but every method below either composes EXISTING
// functions (loadDueRules, loadEnabledRules, isRuleActiveNow — all
// untouched in their own logic) or delegates straight to
// automationEngine.executeRule() (engine.ts, unchanged by this file).
// Nothing here reimplements gating, audience resolution, or delivery.
//
// There is still no setInterval, no node-cron, no vercel cron config, no
// background worker anywhere in this file or anything it calls. Calling
// runPendingRules() today will reliably return an empty array, because
// scheduler.ts has no registered "cron"/"interval" evaluator yet (see
// ruleEngine.ts's loadDueRules) — that's correct, honest behavior, not a
// bug to fix in this part.
//
// ── executeRule(rule) vs runRule(slug) ────────────────────────────────────
// runRule(slug) is for when you only have a slug (manual testing, a
// future admin "run now" button). executeRule(rule) is for when a caller
// (runPendingRules/runAll, below) already has a LOADED rule object and
// shouldn't have to re-fetch it by slug. Both ultimately call
// automationEngine.executeRule(slug, options) — engine.ts's only public
// entry point is slug-based, and adding a second, rule-object-based
// entry point there would mean touching an already-verified module for a
// trivial gain: one extra small AutomationRule document read PER RULE
// per invocation. Rules number in the dozens at most; this is irrelevant
// at the 100,000+-USER scale this brief is concerned with, so the
// simpler, lower-risk choice (delegate via slug, accept the redundant
// read) is the right one here — called out explicitly rather than hidden.

import { loadDueRules, loadEnabledRules, isRuleActiveNow } from "./ruleEngine";
import { automationEngine } from "./engine";
import type { AutomationExecutionResult, AutomationRuleDefinition, ExecuteRuleOptions } from "./types";

function syntheticFailureResult(ruleSlug: string, err: unknown): AutomationExecutionResult {
    const now = new Date();
    return {
        ruleSlug,
        status: "failed",
        dryRun: false,
        executionId: crypto.randomUUID(),
        triggerSource: "manual",
        windowKey: null,
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        usersEvaluated: 0,
        usersMatched: 0,
        usersSkipped: 0,
        notificationsSent: 0,
        notificationsSkipped: 0,
        notificationsFailed: 1,
        preferenceBlockedCount: 0,
        frequencyBlockedCount: 0,
        cooldownBlockedCount: 0,
        deliveryFailedCount: 0,
        errors: [err instanceof Error ? err.message : String(err)],
        warnings: [],
        outcomes: [],
    };
}

class SchedulerRunner {
    /**
     * Runs one rule by slug. Thin delegate to automationEngine.executeRule
     * — that method already does its own load/validate/enabled/active-
     * window checks and never throws, so there's nothing more to add here.
     */
    async runRule(slug: string, options?: ExecuteRuleOptions): Promise<AutomationExecutionResult> {
        return automationEngine.executeRule(slug, options);
    }

    /**
     * Runs an ALREADY-LOADED rule. See file header for why this still
     * goes through automationEngine.executeRule(rule.slug, ...) rather
     * than a rule-object-accepting variant.
     */
    async executeRule(rule: AutomationRuleDefinition, options?: ExecuteRuleOptions): Promise<AutomationExecutionResult> {
        return automationEngine.executeRule(rule.slug, options);
    }

    /**
     * Runs every rule that is enabled, within its active window, AND due
     * per its schedule right now (loadDueRules — see ruleEngine.ts).
     * Today this is reliably a no-op (empty result array) — no
     * "scheduled"/"interval" evaluator exists yet, only "manual" — exactly
     * as required ("NO cron... only execution logic"). This is the method
     * a future cron handler will call on a timer; nothing in this file
     * provides that timer.
     *
     * Resilient by design: one rule throwing is caught HERE (defense in
     * depth — automationEngine.executeRule() is already designed to never
     * throw, catching every internal failure itself and returning a
     * "failed" result instead) so that even an unexpected future change
     * to that guarantee couldn't take down the loop over the remaining
     * rules.
     */
    async runPendingRules(options?: ExecuteRuleOptions): Promise<AutomationExecutionResult[]> {
        const dueRules = await loadDueRules();
        const results: AutomationExecutionResult[] = [];

        for (const rule of dueRules) {
            try {
                results.push(await automationEngine.executeRule(rule.slug, options));
            } catch (err) {
                results.push(syntheticFailureResult(rule.slug, err));
            }
        }

        return results;
    }

    /**
     * Runs every enabled, currently-active rule REGARDLESS of schedule
     * due-ness. Useful for manual ops/testing ("run everything right now")
     * — not something a real scheduler would call on a timer, since it
     * ignores each rule's own cadence entirely.
     */
    async runAll(options?: ExecuteRuleOptions): Promise<AutomationExecutionResult[]> {
        const enabledRules = await loadEnabledRules();
        const activeRules = enabledRules.filter((rule) => isRuleActiveNow(rule));
        const results: AutomationExecutionResult[] = [];

        for (const rule of activeRules) {
            try {
                results.push(await automationEngine.executeRule(rule.slug, options));
            } catch (err) {
                results.push(syntheticFailureResult(rule.slug, err));
            }
        }

        return results;
    }

    /**
     * Runs the complete pipeline for one rule with dryRun forced true,
     * regardless of whatever the caller passed in `options`. Thin
     * delegate — engine.ts's executeRule() already implements the actual
     * dry-run behavior (see its processUser()); this method exists purely
     * so "dry run a rule" has its own clearly-named entry point matching
     * the brief's explicit method list, rather than requiring every
     * caller to remember to set `{ dryRun: true }` themselves.
     */
    async dryRun(slug: string, options?: ExecuteRuleOptions): Promise<AutomationExecutionResult> {
        return automationEngine.executeRule(slug, { ...options, dryRun: true });
    }
}

// Singleton — same hot-reload-safe pattern as automationEngine/notificationEngine.
const globalForScheduler = globalThis as unknown as {
    __fkSchedulerRunner?: SchedulerRunner;
};

export const schedulerRunner = globalForScheduler.__fkSchedulerRunner ?? new SchedulerRunner();

if (process.env.NODE_ENV !== "production") {
    globalForScheduler.__fkSchedulerRunner = schedulerRunner;
}