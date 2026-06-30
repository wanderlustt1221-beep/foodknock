// src/lib/automation/runner/triggerExecutor.ts
//
// FoodKnock Automation Engine — Trigger Executor (Part 4 of 6).
//
// "Every execution must share exactly the same pipeline. No duplicated
// execution code." This is that one pipeline:
//
//   Trigger arrives → Create Execution Context → Acquire Lock →
//   Load Automation Rule → Validate Rule → Execute Automation Engine →
//   Release Lock → Record Metrics → Return Result
//
// manualRunner.ts and batchRunner.ts BOTH call executeTrigger() below —
// neither reimplements any of this. The chain this preserves, unbroken:
//
//   Runner → Automation Engine → Notification Engine → Providers
//
// This file NEVER imports notificationEngine or any DeliveryProvider.
// The only "engine" it calls is automationEngine.executeRule() (Parts
// 1-3, completely unchanged) — delivery, branding, preferences, rotation,
// NotificationLog writes, AutomationUserState updates: all of that stays
// 100% inside the Automation Engine, exactly as before this part existed.
//
// ── ONE DELIBERATE, FLAGGED REDUNDANCY ────────────────────────────────────
// This file calls loadRule()/validateRule() (ruleEngine.ts, Parts 1-3,
// unchanged) itself, BEFORE calling automationEngine.executeRule() —
// which redundantly re-loads and re-validates the SAME rule internally
// (Parts 1-3's executeRule() always does this, regardless of caller).
// That's one extra small AutomationRule document read per execution
// attempt — not per user, so irrelevant at the 100,000+-USER scale this
// brief cares about. The alternative (modifying automationEngine to
// accept a pre-loaded rule) would mean touching an already-verified
// module for a trivial gain, which Part 4 explicitly says not to do. The
// upside this redundancy buys: the Runner can fail fast — clear "rule not
// found" / "rule invalid" results — WITHOUT ever acquiring a lock for a
// request that was never going to succeed, and without waiting on the
// Automation Engine to discover the same problem a layer down. This is
// the exact same tradeoff already made (and flagged) in Part 3's
// SchedulerRunner.executeRule(rule).

import { loadRule, validateRule } from "../ruleEngine";
import { automationEngine } from "../engine";
import type { ExecuteRuleOptions } from "../types";
import { createExecutionContext } from "./executionContext";
import type { ExecutionContext, RunnerExecutionResult, TriggerSource } from "./executionContext";
import { lockManager } from "./lockManager";
import { runnerMetrics } from "./metrics";
import type { TriggerRequest } from "./triggerRegistry";

export type ExecuteTriggerOptions = Pick<ExecuteRuleOptions, "batchSize" | "concurrency" | "maxDetailedOutcomes"> & {
    /** Shared across every rule in one batch — see executionContext.ts's createExecutionContext doc. Ignored for a standalone single-rule call. */
    traceId?: string;
};

/**
 * The one pipeline. Never throws — every failure path (lock contention,
 * rule not found, invalid rule, or an unexpected exception from the
 * Automation Engine itself) resolves to a RunnerExecutionResult with the
 * failure reflected in its fields, the same "always resolves, never
 * rejects" guarantee automationEngine.executeRule() already provides one
 * layer down — callers (manualRunner, batchRunner) can rely on this
 * without their own additional try/catch around this call (though
 * batchRunner.ts still has one anyway, as defense in depth — see its header).
 */
export async function executeTrigger(
    request: TriggerRequest,
    source: TriggerSource,
    options?: ExecuteTriggerOptions
): Promise<RunnerExecutionResult> {
    // ── Create Execution Context ──────────────────────────────────────────
    const context = createExecutionContext({
        triggerSource: source,
        initiatedBy: request.initiatedBy,
        dryRun: request.dryRun,
        metadata: request.metadata,
        traceId: options?.traceId,
    });

    const lockKey = `automation-rule:${request.ruleSlug}`;

    // ── Acquire Lock ───────────────────────────────────────────────────────
    const lock = await lockManager.acquire(lockKey);
    if (!lock) {
        return finalize(context, request.ruleSlug, {
            lockAcquired: false,
            ruleFound: false,
            ruleValid: false,
            automationResult: null,
            runnerError: `Rule "${request.ruleSlug}" is already executing — concurrent execution prevented.`,
        }, "skipped");
    }

    try {
        // ── Load Automation Rule ───────────────────────────────────────────
        const rule = await loadRule(request.ruleSlug);
        if (!rule) {
            return finalize(context, request.ruleSlug, {
                lockAcquired: true,
                ruleFound: false,
                ruleValid: false,
                automationResult: null,
                runnerError: `No rule found for slug "${request.ruleSlug}".`,
            }, "failed");
        }

        // ── Validate Rule ──────────────────────────────────────────────────
        const validation = validateRule(rule);
        if (!validation.valid) {
            return finalize(context, request.ruleSlug, {
                lockAcquired: true,
                ruleFound: true,
                ruleValid: false,
                automationResult: null,
                runnerError: `Rule "${request.ruleSlug}" failed validation: ${validation.errors.join("; ")}`,
            }, "failed");
        }

        // ── Execute Automation Engine ───────────────────────────────────────
        // The one call that does real work — everything above this line is
        // Runner-layer gating, everything below is bookkeeping. See file
        // header for the deliberate redundancy this call's own internal
        // load/validate represents.
        runnerMetrics.recordStart();
        try {
            const automationResult = await automationEngine.executeRule(request.ruleSlug, {
                dryRun: context.dryRun,
                batchSize: options?.batchSize,
                concurrency: options?.concurrency,
                maxDetailedOutcomes: options?.maxDetailedOutcomes,
            });

            const outcome: "completed" | "failed" =
                automationResult.status === "failed" ? "failed" : "completed";

            return finalize(context, request.ruleSlug, {
                lockAcquired: true,
                ruleFound: true,
                ruleValid: true,
                automationResult,
            }, outcome);
        } catch (err) {
            // Defense in depth — automationEngine.executeRule() is designed
            // to never throw (Parts 1-3), but the Runner must not assume
            // that guarantee holds forever as that module evolves.
            const message = err instanceof Error ? err.message : String(err);
            return finalize(context, request.ruleSlug, {
                lockAcquired: true,
                ruleFound: true,
                ruleValid: true,
                automationResult: null,
                runnerError: `Automation Engine threw unexpectedly: ${message}`,
            }, "failed");
        }
    } finally {
        // ── Release Lock ───────────────────────────────────────────────────
        // In `finally` so the lock is released whether execution succeeded,
        // failed, or threw — a stuck lock would itself become the kind of
        // problem this module exists to prevent.
        await lockManager.release(lock);
    }
}

function finalize(
    context: ExecutionContext,
    ruleSlug: string,
    partial: Omit<RunnerExecutionResult, "context" | "finishedAt" | "durationMs">,
    metricsOutcome: "completed" | "failed" | "skipped"
): RunnerExecutionResult {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - context.startedAt.getTime();

    // ── Record Metrics ───────────────────────────────────────────────────
    // recordStart() was only called right before the Automation Engine
    // call (see above) — for lock-contention/not-found/invalid results,
    // there is no matching recordStart() to balance, so recordFinish()
    // must NOT be called for those (it would misrepresent these as "an
    // execution ran" when one never actually started).
    if (partial.lockAcquired && partial.ruleFound && partial.ruleValid) {
        runnerMetrics.recordFinish(metricsOutcome, durationMs, ruleSlug);
    }

    return { context, finishedAt, durationMs, ...partial };
}