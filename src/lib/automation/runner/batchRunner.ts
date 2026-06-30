// src/lib/automation/runner/batchRunner.ts
//
// FoodKnock Automation Engine — Batch Runner (Part 4 of 6).
//
// "Support executing many rules. Limit concurrency. Chunk execution.
// Never execute unlimited promises. Reuse worker pool." Reuses
// runWithConcurrency from ../engine.ts directly — the EXACT same,
// already-verified worker pool engine.ts itself uses for per-user
// processing, exported for this purpose (see engine.ts's own comment on
// that export). No second implementation of bounded concurrency exists
// anywhere in this codebase.
//
// Every rule still goes through executeTrigger() — the one pipeline. This
// file's only job is fan-out: call that pipeline for N rule slugs without
// running all N at once.

import { runWithConcurrency } from "../engine";
import { executeTrigger } from "./triggerExecutor";
import type { ExecuteTriggerOptions } from "./triggerExecutor";
import { triggerRegistry } from "./triggerRegistry";
import type { RunnerExecutionResult, TriggerSource } from "./executionContext";

const DEFAULT_BATCH_CONCURRENCY = 5;

export type RunBatchInput = {
    ruleSlugs: string[];
    dryRun?: boolean;
    initiatedBy?: string;
    metadata?: Record<string, unknown>;
    /** Bounds how many rules execute concurrently within this batch — distinct from each rule's OWN internal per-user concurrency (ExecuteTriggerOptions.concurrency, passed through unchanged to every rule). Default 5: rules do real audience-resolution + delivery work, so a much lower bound than per-user concurrency (default 20) is appropriate. */
    batchConcurrency?: number;
};

/**
 * Runs every rule in `input.ruleSlugs` through the SAME pipeline
 * (executeTrigger) used by manualRunner.ts, bounded by
 * `batchConcurrency`. Every rule shares one traceId, so this batch's
 * executions can be found together later (see executionContext.ts).
 *
 * Per-rule isolation: runWithConcurrency's worker callback below has its
 * own try/catch — even though executeTrigger() is designed to never
 * throw (every failure path resolves to a RunnerExecutionResult), this
 * is defense in depth, the same posture taken everywhere else a "must
 * never stop the rest" guarantee matters in this codebase.
 */
export async function runBatch(
    input: RunBatchInput,
    options?: ExecuteTriggerOptions,
    source: TriggerSource = "manual"
): Promise<RunnerExecutionResult[]> {
    const traceId = options?.traceId ?? crypto.randomUUID();
    const concurrency = input.batchConcurrency ?? DEFAULT_BATCH_CONCURRENCY;

    return runWithConcurrency(input.ruleSlugs, concurrency, async (ruleSlug) => {
        try {
            const request = triggerRegistry.normalize(source, {
                ruleSlug,
                dryRun: input.dryRun,
                initiatedBy: input.initiatedBy,
                metadata: input.metadata,
            });
            return await executeTrigger(request, source, { ...options, traceId });
        } catch (err) {
            // A throw here means normalize() itself rejected the input
            // (e.g. malformed ruleSlug) — executeTrigger() never throws,
            // so this only catches that earlier, narrower failure mode.
            const now = new Date();
            return {
                context: {
                    executionId: crypto.randomUUID(),
                    traceId,
                    triggerSource: source,
                    startedAt: now,
                    dryRun: input.dryRun ?? false,
                    metadata: input.metadata ?? {},
                },
                finishedAt: now,
                durationMs: 0,
                lockAcquired: false,
                ruleFound: false,
                ruleValid: false,
                automationResult: null,
                runnerError: err instanceof Error ? err.message : String(err),
            };
        }
    });
}