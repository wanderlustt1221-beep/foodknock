// src/lib/automation/runner/index.ts
//
// FoodKnock Automation Engine — Runner public entry point (Part 4 of 6).
//
// Mirrors automation/index.ts's own "one door in" pattern. Code outside
// this folder should import from here, not from individual files inside it.

export { runner } from "./runner";
export { runManual } from "./manualRunner";
export type { RunManualInput } from "./manualRunner";
export { runBatch } from "./batchRunner";
export type { RunBatchInput } from "./batchRunner";
export { executeTrigger } from "./triggerExecutor";
export type { ExecuteTriggerOptions } from "./triggerExecutor";
export { triggerRegistry } from "./triggerRegistry";
export type { TriggerHandler, TriggerRequest } from "./triggerRegistry";
export { lockManager, InMemoryLockManager } from "./lockManager";
export type { Lock, LockManager } from "./lockManager";
export { runnerMetrics } from "./metrics";
export type { RunnerMetricsSnapshot, LastExecutionSummary } from "./metrics";
export { getRunnerHealth } from "./health";
export type { RunnerHealthSnapshot } from "./health";
export { createExecutionContext } from "./executionContext";
export type {
    ExecutionContext,
    CreateExecutionContextInput,
    RunnerExecutionResult,
    TriggerSource,
} from "./executionContext";
export type { Queue, QueueJob, QueueJobStatus } from "./queue";