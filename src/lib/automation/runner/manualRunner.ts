// src/lib/automation/runner/manualRunner.ts
//
// FoodKnock Automation Engine — Manual Runner (Part 4 of 6).
//
// The simplest entry point: "run this one rule, right now". Genuinely
// routes through triggerRegistry's normalize() step (rather than building
// a TriggerRequest by hand and skipping the registry) so the pattern is
// exercised end-to-end today, not just declared and left unused until
// some future trigger source needs it.

import { executeTrigger } from "./triggerExecutor";
import type { ExecuteTriggerOptions } from "./triggerExecutor";
import { triggerRegistry } from "./triggerRegistry";
import type { RunnerExecutionResult } from "./executionContext";

export type RunManualInput = {
    ruleSlug: string;
    dryRun?: boolean;
    initiatedBy?: string;
    metadata?: Record<string, unknown>;
};

export async function runManual(
    input: RunManualInput,
    options?: ExecuteTriggerOptions
): Promise<RunnerExecutionResult> {
    const request = triggerRegistry.normalize("manual", input);
    return executeTrigger(request, "manual", options);
}