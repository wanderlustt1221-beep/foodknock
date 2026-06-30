// src/lib/automation/runner/metrics.ts
//
// FoodKnock Automation Engine — Runner Metrics (Part 4 of 6).
//
// "Execution Metrics. Keep separate from analytics. Only runner metrics."
// This module owns exactly that and nothing more: in-memory counters and
// a bounded recent-duration window for the Runner's OWN operational
// visibility (is it healthy, how fast is it processing, how many things
// are in flight right now). It has no opinion on notification open
// rates, campaign performance, or anything a future Analytics part would
// care about — those are a different concern entirely, reading from
// NotificationLog/AutomationExecution, not from here.
//
// health.ts is a thin READER over this module's data — this is the only
// place execution counts/durations are actually recorded, so the two
// files can never drift into reporting inconsistent numbers.

export type LastExecutionSummary = {
    ruleSlug: string;
    outcome: "completed" | "failed" | "skipped";
    finishedAt: Date;
    durationMs: number;
};

export type RunnerMetricsSnapshot = {
    runningCount: number;
    completedCount: number;
    failedCount: number;
    skippedCount: number;
    averageDurationMs: number;
    lastExecution: LastExecutionSummary | null;
};

/** How many recent execution durations to average over — a recent window is more operationally useful ("how fast is it running right now") than an all-time average since process start. */
const DURATION_WINDOW_SIZE = 200;

class RunnerMetrics {
    private runningCount = 0;
    private completedCount = 0;
    private failedCount = 0;
    private skippedCount = 0;
    private recentDurationsMs: number[] = [];
    private lastExecution: LastExecutionSummary | null = null;

    /** Call when an execution actually begins running the Automation Engine — NOT when a trigger merely arrives (a lock-blocked attempt never reaches this point; see triggerExecutor.ts). */
    recordStart(): void {
        this.runningCount++;
    }

    /**
     * Call exactly once per recordStart(), when that execution finishes
     * (success, failure, or a clean skip) — `outcome` and `durationMs`
     * describe the COMPLETED attempt, not the running-count change (which
     * this method also handles, decrementing it).
     */
    recordFinish(outcome: "completed" | "failed" | "skipped", durationMs: number, ruleSlug: string): void {
        this.runningCount = Math.max(0, this.runningCount - 1);

        if (outcome === "completed") this.completedCount++;
        else if (outcome === "failed") this.failedCount++;
        else this.skippedCount++;

        this.recentDurationsMs.push(durationMs);
        if (this.recentDurationsMs.length > DURATION_WINDOW_SIZE) {
            this.recentDurationsMs.shift();
        }

        this.lastExecution = { ruleSlug, outcome, finishedAt: new Date(), durationMs };
    }

    snapshot(): RunnerMetricsSnapshot {
        const total = this.recentDurationsMs.length;
        const averageDurationMs =
            total === 0 ? 0 : this.recentDurationsMs.reduce((sum, d) => sum + d, 0) / total;

        return {
            runningCount: this.runningCount,
            completedCount: this.completedCount,
            failedCount: this.failedCount,
            skippedCount: this.skippedCount,
            averageDurationMs,
            lastExecution: this.lastExecution,
        };
    }
}

// Singleton — same hot-reload-safe pattern as every other in-memory
// singleton in this module.
const globalForMetrics = globalThis as unknown as {
    __fkRunnerMetrics?: RunnerMetrics;
};

export const runnerMetrics = globalForMetrics.__fkRunnerMetrics ?? new RunnerMetrics();

if (process.env.NODE_ENV !== "production") {
    globalForMetrics.__fkRunnerMetrics = runnerMetrics;
}