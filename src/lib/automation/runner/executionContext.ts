// src/lib/automation/runner/executionContext.ts
//
// FoodKnock Automation Engine — Execution Context (Part 4 of 6).
//
// The strongly-typed envelope every execution carries through the
// Runner's pipeline, regardless of what triggered it. This is NEW —
// nothing in Parts 1-3 has a concept of "who/what/why triggered this run"
// separate from the rule itself; AutomationExecutionResult (Parts 1-3)
// only knows about the RULE's own outcome, not the INVOCATION's identity.
//
// RunnerExecutionResult wraps that existing, UNCHANGED type rather than
// extending or replacing it — see its own comment below for why.

import type { AutomationExecutionResult } from "../types";

/**
 * Where an execution attempt came from. Extensible by design — the
 * registry in triggerRegistry.ts is what makes new sources pluggable
 * without switch-statement sprawl; this union exists for type-safety on
 * the well-known sources, not as a closed set enforced anywhere at
 * runtime (a string outside this union is still accepted — see
 * TriggerSource's usage in triggerRegistry.ts).
 */
export type TriggerSource = "manual" | "api" | "scheduled" | "queue" | string;

export type ExecutionContext = {
    /** Unique per execution attempt. Generated fresh every time — never reused, even for retries of the "same" logical request. */
    executionId: string;
    /**
     * Correlates related executions/log lines across a single logical
     * operation. Defaults to executionId for a standalone single-rule run
     * (where "this execution" and "this operation" are the same thing);
     * a batch run shares ONE traceId across every rule it executes, so
     * all of them can be found together later.
     */
    traceId: string;
    triggerSource: TriggerSource;
    startedAt: Date;
    /** Who or what asked for this — an admin user id, "system", a queue consumer id, etc. Optional: many trigger sources have no meaningful identity to attach (e.g. a bare manual call in a script). */
    initiatedBy?: string;
    dryRun: boolean;
    /** Free-form, future-proofing bucket — anything not yet promoted to a real field lives here without requiring a type change. */
    metadata: Record<string, unknown>;
};

export type CreateExecutionContextInput = {
    triggerSource: TriggerSource;
    initiatedBy?: string;
    dryRun?: boolean;
    metadata?: Record<string, unknown>;
    /** Supply this to make several executions share one traceId (e.g. batchRunner.ts passes the same traceId to every rule in one batch). Defaults to a fresh value equal to the new executionId. */
    traceId?: string;
};

function generateId(): string {
    // crypto.randomUUID() is a Node 14.17+ global — no new dependency.
    return crypto.randomUUID();
}

export function createExecutionContext(input: CreateExecutionContextInput): ExecutionContext {
    const executionId = generateId();
    return {
        executionId,
        traceId: input.traceId ?? executionId,
        triggerSource: input.triggerSource,
        startedAt: new Date(),
        initiatedBy: input.initiatedBy,
        dryRun: input.dryRun ?? false,
        metadata: input.metadata ?? {},
    };
}

/**
 * What the Runner returns — NOT a replacement for AutomationExecutionResult
 * (Parts 1-3's per-rule-run result, returned unchanged inside
 * `automationResult` below), but a wrapper around it that also captures
 * RUNNER-LAYER outcomes (lock contention, rule-not-found) that happen
 * BEFORE the Automation Engine is ever reached and so could never be
 * represented inside AutomationExecutionResult itself.
 *
 * `automationResult` is null exactly when execution never reached the
 * Automation Engine at all — check `lockAcquired`/`ruleFound`/`ruleValid`
 * (in that order) to find out why.
 */
export type RunnerExecutionResult = {
    context: ExecutionContext;
    finishedAt: Date;
    durationMs: number;
    lockAcquired: boolean;
    ruleFound: boolean;
    ruleValid: boolean;
    automationResult: AutomationExecutionResult | null;
    /** A Runner-layer failure message — set only when something went wrong BEFORE/AROUND the Automation Engine call (e.g. lock acquisition itself threw). Failures INSIDE the engine are already captured in automationResult.errors. */
    runnerError?: string;
};
