// src/lib/automation/runner/runner.ts
//
// FoodKnock Automation Engine — Runner Facade (Part 4 of 6).
//
// The single public surface most callers reach for — mirrors how
// automationEngine and schedulerRunner (Parts 1-3) are each one object
// wrapping their module's capabilities. Every method here is pure
// delegation to a sibling file; no logic lives in this file itself.

import { runManual } from "./manualRunner";
import type { RunManualInput } from "./manualRunner";
import { runBatch } from "./batchRunner";
import type { RunBatchInput } from "./batchRunner";
import { getRunnerHealth } from "./health";
import type { RunnerHealthSnapshot } from "./health";
import type { ExecuteTriggerOptions } from "./triggerExecutor";
import type { RunnerExecutionResult, TriggerSource } from "./executionContext";

class Runner {
    /** Single Rule Execution / Manual Execution — see manualRunner.ts. */
    async runOne(input: RunManualInput, options?: ExecuteTriggerOptions): Promise<RunnerExecutionResult> {
        return runManual(input, options);
    }

    /**
     * Batch Execution — see batchRunner.ts. `source` defaults to "manual"
     * (unchanged from this method's original signature) — passing
     * "scheduled" is what lets Part 5's runnerApi.ts correctly attribute
     * its own batch calls without reaching past this facade into
     * batchRunner.ts directly.
     */
    async runBatch(input: RunBatchInput, options?: ExecuteTriggerOptions, source: TriggerSource = "manual"): Promise<RunnerExecutionResult[]> {
        return runBatch(input, options, source);
    }

    /** Runner Health API (internal only) — see health.ts. */
    getHealth(): RunnerHealthSnapshot {
        return getRunnerHealth();
    }
}

// Singleton — same hot-reload-safe pattern as every other singleton in
// this module (automationEngine, schedulerRunner, lockManager, etc.).
const globalForRunner = globalThis as unknown as {
    __fkRunner?: Runner;
};

export const runner = globalForRunner.__fkRunner ?? new Runner();

if (process.env.NODE_ENV !== "production") {
    globalForRunner.__fkRunner = runner;
}