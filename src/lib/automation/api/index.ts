// src/lib/automation/api/index.ts
//
// FoodKnock Automation Engine — Official Public Automation API (Part 6 of 6).
//
// "These become the ONLY public entry points for automation. Everything
// else remains internal." This barrel exports EXACTLY the six functions
// the brief specifies — runDueAutomations, runRule, dryRun,
// retryExecution, cancelExecution, getExecutionReport — and the
// ExecutionReport type every one of them returns. Nothing else from this
// folder, and nothing from engine.ts/ruleEngine.ts/runner/scheduling/
// directly, is re-exported here. Any future API route, admin action, or
// other consumer should import ONLY from this file.

export { runDueAutomations, runRule } from "./automationApi";
export { dryRun } from "./dryRun";
export { retryExecution } from "./retry";
export { cancelExecution } from "./cancel";
export type { CancellationResult, CancellationStatus, CancellationRegistry } from "./cancel";
export { getExecutionReport } from "./executionReport";
export type { ExecutionReport } from "./executionReport";