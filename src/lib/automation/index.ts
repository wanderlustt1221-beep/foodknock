// src/lib/automation/index.ts
//
// FoodKnock Automation Engine — public entry point (Part 1 + 2 + 3 + 4 + 5 of 6).
//
// Mirrors src/lib/notifications/index.ts deliberately: one door in. Other
// code (future API routes, future admin UI, a future real scheduler)
// should import from here, not from engine.ts/ruleEngine.ts/etc. directly.
//
// ── PART 6 NOTE ────────────────────────────────────────────────────────────
// Part 6 adds src/lib/automation/api/ as the OFFICIAL, minimal public
// surface (runDueAutomations, runRule, dryRun, retryExecution,
// cancelExecution, getExecutionReport) — any NEW consumer (a future API
// route, admin action) should import from "@/lib/automation/api"
// specifically, not from this broader barrel. This file is intentionally
// left exactly as Parts 1-5 built it rather than merged with api/'s
// exports: several names genuinely collide (this barrel already exports
// its own `dryRun`, from Part 5's scheduling/runnerApi.ts, which is a
// different function with a different signature than api/'s `dryRun`) —
// attempting to combine them into one barrel would be a real naming
// conflict, not just redundant. Both barrels coexist; this one remains
// the complete Parts 1-5 surface, api/ is the new, deliberately narrower
// official surface Part 6 asked for.

export { automationEngine, runWithConcurrency } from "./engine";
export { schedulerRunner } from "./schedulerRunner";
export { loadRule, loadEnabledRules, loadDueRules, validateRule, isRuleEnabled, isRuleActiveNow } from "./ruleEngine";
export { evaluateCondition, evaluateConditions, conditionFieldRegistry } from "./conditions";
export type { ConditionFieldResolver } from "./conditions";
export { checkCooldown, checkAllCooldowns } from "./cooldown";
export type { CooldownDimension, PerRuleCooldownState } from "./cooldown";
export { checkFrequencyLimit, checkAllFrequencyLimits, nextWindowState, FREQUENCY_WINDOW_MS } from "./frequencyLimiter";
export type { FrequencyDimension, FrequencyState, FrequencyLimits } from "./frequencyLimiter";
export { resolveAudience, audienceResolverRegistry } from "./audienceResolver";
export type { AudienceResolver } from "./audienceResolver";
export { isRuleDue, schedulerRegistry } from "./scheduler";
export type { ScheduleEvaluator } from "./scheduler";
export { selectContentForRule, contentSelectorRegistry } from "./rotation";
export type { ContentSelector } from "./rotation";
export { logAutomationExecution } from "./logger";
export { DEFAULT_RULES } from "./defaultRules";

// ── Part 4: Runner layer ───────────────────────────────────────────────────
// Runner → Automation Engine → Notification Engine → Providers. The
// Runner exports below are the ONLY new public surface added in Part 4 —
// everything above this line is Parts 1-3, unchanged.
export { runner, runManual, runBatch, executeTrigger, triggerRegistry, lockManager, InMemoryLockManager, runnerMetrics, getRunnerHealth, createExecutionContext } from "./runner";
export type {
    RunManualInput,
    RunBatchInput,
    ExecuteTriggerOptions,
    TriggerHandler,
    TriggerRequest,
    Lock,
    LockManager,
    RunnerMetricsSnapshot,
    LastExecutionSummary,
    RunnerHealthSnapshot,
    ExecutionContext,
    CreateExecutionContextInput,
    RunnerExecutionResult,
    TriggerSource,
    Queue,
    QueueJob,
    QueueJobStatus,
} from "./runner";

// ── Part 5: Scheduling layer ─────────────────────────────────────────────
// Scheduler (this) → Runner (Part 4) → Automation Engine (Parts 1-3) →
// Notification Engine → Providers. The four functions below
// (runDueAutomations/runRuleNow/previewRule/dryRun) are the public API a
// future cron-triggered route should call — everything else in
// scheduling/ is internal machinery.
export { runDueAutomations, runRuleNow, previewRule, dryRun } from "./scheduling";
export type { RunDueAutomationsOptions, RunDueAutomationsResult, PreviewResult } from "./scheduling";

export type {
    AutomationTriggerType,
    AutomationTrigger,
    AutomationConditionOperator,
    AutomationCondition,
    AutomationConditionContext,
    AutomationAudienceType,
    AutomationAudience,
    AutomationScheduleType,
    AutomationSchedule,
    AutomationRuleDefinition,
    AutomationGateResult,
    AutomationExecutionStatus,
    AutomationExecutionResult,
    UserExecutionOutcomeStatus,
    UserExecutionOutcome,
    ExecuteRuleOptions,
    RuleValidationResult,
} from "./types";