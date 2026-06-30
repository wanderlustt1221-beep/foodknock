// src/lib/automation/runner/health.ts
//
// FoodKnock Automation Engine — Runner Health (Part 4 of 6).
//
// "Runner Health API (internal only)... No UI. No routes. Internal
// service only." This is exactly that: a plain function, not an HTTP
// endpoint — a future API route (a later part) would import and call
// getRunnerHealth() itself; this file has no opinion on how its result
// gets exposed.
//
// Deliberately thin: every number here is read from runnerMetrics
// (metrics.ts), never recorded independently — see that file's header
// for why keeping a single source of truth matters.

import { runnerMetrics } from "./metrics";
import type { LastExecutionSummary } from "./metrics";

export type RunnerHealthSnapshot = {
    runningExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
    averageExecutionTimeMs: number;
    /**
     * Always 0. queue.ts is genuinely interface-only (see its header) —
     * there is no real queue implementation anywhere to report a depth
     * for. This field exists now so a future real queue integration is
     * additive to this snapshot's shape, not a breaking change to it.
     */
    queueDepth: number;
    lastExecution: LastExecutionSummary | null;
};

export function getRunnerHealth(): RunnerHealthSnapshot {
    const snapshot = runnerMetrics.snapshot();

    return {
        runningExecutions: snapshot.runningCount,
        completedExecutions: snapshot.completedCount,
        failedExecutions: snapshot.failedCount,
        averageExecutionTimeMs: snapshot.averageDurationMs,
        queueDepth: 0,
        lastExecution: snapshot.lastExecution,
    };
}