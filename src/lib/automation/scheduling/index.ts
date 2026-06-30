// src/lib/automation/scheduling/index.ts
//
// FoodKnock Automation Engine — Scheduling public entry point (Part 5 of 6).
//
// Mirrors automation/index.ts and runner/index.ts's own "one door in"
// pattern. A future API route (a later part) should import the four
// runnerApi.ts functions from here, never reaching into
// windowEvaluator.ts/executionLimiter.ts/etc. directly.

export { runDueAutomations, runRuleNow, previewRule, dryRun } from "./runnerApi";
export type { RunDueAutomationsOptions, RunDueAutomationsResult, PreviewResult } from "./runnerApi";

export { planDueExecutions, planForRule } from "./executionPlanner";
export type { ExecutionPlan, PlannedExecution } from "./executionPlanner";

export { resolveRecoverableWindows, DEFAULT_RECOVERY_LOOKBACK_MS } from "./missedExecution";
export type { RecoverableWindow } from "./missedExecution";

export { resolveDueWindows } from "./windowEvaluator";
export type { DueWindow } from "./windowEvaluator";

export { selectSchedulableRules } from "./ruleSelector";

export { claimWindow, markWindowOutcome, isWindowClaimed } from "./executionLimiter";
export type { WindowClaim } from "./executionLimiter";

export { scheduleResolverRegistry } from "./scheduleResolver";
export type { WindowScheduleResolver, TimeSlot } from "./scheduleResolver";

export { getLocalParts, formatTimeSlot } from "./timeResolver";
export type { LocalTimeParts } from "./timeResolver";