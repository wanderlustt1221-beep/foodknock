// src/lib/automation/types.ts
//
// FoodKnock Automation Engine — core contracts (Part 1 of 6).
//
// Mirrors the relationship between src/lib/notifications/types.ts and the
// rest of the notifications module: this file is the permanent boundary
// every other automation module reads from. No automation module should
// redefine a shape declared here.
//
// ── REUSE, NOT DUPLICATION ────────────────────────────────────────────────
// category/priority/channels reuse the EXISTING NotificationCategory/
// NotificationPriority/NotificationChannel unions from the notifications
// module — an automation rule's notification still has to flow through
// the same engine, the same branding, and the same preference gate as
// everything else, so it must speak the same vocabulary. libraryCategory
// reuses the existing MarketingSlot type for the same reason: it's the
// key the existing marketing rotation system already understands.

import type {
    NotificationCategory,
    NotificationChannel,
    NotificationPayload,
    NotificationPriority,
} from "@/lib/notifications/types";
import type { MarketingSlot } from "@/lib/notifications/marketing/types";

// ── Trigger ──────────────────────────────────────────────────────────────
// What kind of thing causes a rule to be considered for execution. Only
// the *shape* is defined here — there is no scheduler implementation in
// Part 1 (no cron, no interval timers). "scheduled" rules simply cannot
// fire yet; "manual" rules are the only kind anything can invoke today
// (by calling automationEngine.executeRule() directly).
export type AutomationTriggerType = "scheduled" | "event" | "manual";

export type AutomationTrigger = {
    type: AutomationTriggerType;
    /** Trigger-specific config (e.g. a future cron expression, or an event name). Deliberately untyped — see scheduler.ts. */
    config?: Record<string, unknown>;
};

// ── Conditions ───────────────────────────────────────────────────────────
// A generic, domain-agnostic comparison. conditions.ts's evaluator knows
// nothing about FoodKnock's business domain — it just compares a field
// path (dot-notation, e.g. "automationState.dailyCount") against a value.
// Real domain-specific fields (order history, loyalty tier, etc.) are
// supplied by whatever builds the ConditionContext — not this module's
// concern, and not implemented in Part 1.
export type AutomationConditionOperator =
    | "eq" | "neq"
    | "gt" | "gte" | "lt" | "lte"
    | "in" | "nin"
    | "exists";

export type AutomationCondition = {
    field: string;
    operator: AutomationConditionOperator;
    value?: unknown;
};

/** All conditions in the array must pass (AND semantics) for Part 1. OR/grouping is a future, additive extension — see conditions.ts. */
export type AutomationConditionContext = Record<string, unknown>;

// ── Audience ─────────────────────────────────────────────────────────────
// What kind of group a rule targets. Only "explicit_user_ids" has a real
// resolver registered in Part 1 (a mechanical pass-through, zero business
// logic) — see audienceResolver.ts for why "all_users" / "segment" are
// declared here but deliberately left unregistered.
export type AutomationAudienceType =
    | "all_users"
    | "segment"
    | "explicit_user_ids"
    // Part 2 — real, mechanical, config-parameterized resolvers (see
    // audienceResolver.ts for which of these have a registered
    // implementation vs. an honest "not yet, no data source" gap).
    | "new_users"
    | "returning_users"
    | "vip_users"
    | "inactive_users"
    | "city"
    | "pincode"
    | "referral_users"
    | "loyalty_users"
    | "cart_users"
    | "birthday_users";

export type AutomationAudience = {
    type: AutomationAudienceType;
    config?: Record<string, unknown>;
};

// ── Schedule ─────────────────────────────────────────────────────────────
// Mirrors AutomationTrigger's "declare the shape, defer the mechanism"
// approach. No scheduler reads these yet — see scheduler.ts.
export type AutomationScheduleType =
    | "cron"
    | "interval"
    | "manual"
    // Part 5 — real, named recurrence types with registered ScheduleEvaluators
    // (see scheduler.ts's registry and runner/scheduling/scheduleResolver.ts).
    // Kept alongside "cron"/"interval" rather than replacing them: those
    // remain available for a future raw-cron-expression need this set of
    // named patterns doesn't cover.
    | "immediate"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "specific_time"
    | "multiple_times_per_day"
    | "specific_days";

export type AutomationSchedule = {
    type: AutomationScheduleType;
    config?: Record<string, unknown>;
};

// ── Rule definition (the TS-level shape; AutomationRule.ts is its persisted form) ─
export type AutomationRuleDefinition = {
    id: string;
    slug: string;
    name: string;
    enabled: boolean;
    trigger: AutomationTrigger;
    conditions: AutomationCondition[];
    audience: AutomationAudience;
    schedule: AutomationSchedule;
    category: NotificationCategory;
    priority: NotificationPriority;
    libraryCategory: MarketingSlot;
    maxPerHour: number | null;
    maxPerDay: number;
    cooldownHours: number;
    // Part 2: optional multi-dimensional gating — null means "not enforced",
    // matching the model's defaults so a rule that doesn't set these
    // behaves exactly as it did in Part 1.
    categoryCooldownHours: number | null;
    campaignCooldownHours: number | null;
    categoryMaxPerDay: number | null;
    campaignMaxPerDay: number | null;
    maxLifetime: number | null;
    channels: NotificationChannel[];
    activeFrom: Date | null;
    activeUntil: Date | null;
    timezone: string;
    metadata: Record<string, unknown>;
};

// ── Gate check results ───────────────────────────────────────────────────
// Shared shape for cooldown.ts and frequencyLimiter.ts — both answer the
// same kind of question ("is this user eligible right now") with the same
// shape, so engine.ts can treat them uniformly.
export type AutomationGateResult = {
    allowed: boolean;
    reason?: string;
};

// ── Execution result ─────────────────────────────────────────────────────
// What executeRule() returns — a summary of one rule-run, NOT a per-
// recipient delivery record (that's NotificationLog's job, unchanged).
//
// Field semantics (Part 3 refinement — this type has had exactly two
// internal consumers since it was created, engine.ts and automation/
// logger.ts, both updated in this same change; nothing outside the
// automation module reads it yet, since no API/UI exists):
//   usersEvaluated    = size of the resolved audience
//   usersMatched      = passed every gate (conditions + cooldown + frequency)
//   usersSkipped      = FAILED a gate — never became a send candidate
//   notificationsSent = actually delivered via notificationEngine.send()
//   notificationsSkipped = MATCHED, but no notification resulted — either
//                           no marketing content was available for the
//                           slot, OR (dry runs only) deliberately not sent
//   notificationsFailed  = an exception was thrown while processing
// Invariant: usersMatched === notificationsSent + notificationsSkipped,
// and usersEvaluated === usersMatched + usersSkipped + notificationsFailed.
export type AutomationExecutionStatus = "success" | "partial" | "failed" | "skipped";

export type AutomationExecutionResult = {
    /**
     * Part 6: a stable identifier for this one execution attempt,
     * persisted (see AutomationExecution's executionId field) so
     * automation/api/executionReport.ts can retrieve a report for a past
     * execution from a LATER, separate invocation — required because
     * Vercel Hobby is stateless; nothing in-memory survives between
     * serverless invocations. Always populated: auto-generated via
     * crypto.randomUUID() if the caller doesn't supply one via
     * ExecuteRuleOptions.executionId (e.g. a direct, non-Runner call).
     */
    executionId: string;
    ruleSlug: string;
    status: AutomationExecutionStatus;
    /** True for dryRun()/dry-run executeRule() calls — these are NEVER persisted to AutomationExecution (see automation/logger.ts's caller in engine.ts) regardless of this flag's presence on the in-memory result. */
    dryRun: boolean;
    /**
     * Part 6: where this execution was invoked from — Part 4's
     * ExecutionContext.triggerSource, threaded through via
     * ExecuteRuleOptions.triggerSource. Defaults to "manual" for any
     * caller that doesn't supply one (e.g. a direct executeRule() call
     * outside the Runner layer) — unchanged from every existing caller's
     * actual behavior before this field existed.
     */
    triggerSource: string;
    /** Part 6: the Part 5 scheduling window this execution represents, if any — null for manual/retry runs that bypass window-based scheduling entirely. */
    windowKey: string | null;
    startedAt: Date;
    finishedAt: Date;
    durationMs: number;
    usersEvaluated: number;
    usersMatched: number;
    usersSkipped: number;
    notificationsSent: number;
    notificationsSkipped: number;
    notificationsFailed: number;
    /**
     * Part 6: granular breakdowns of usersSkipped/notificationsFailed —
     * ADDITIVE, computed from the EXACT SAME per-user classification
     * processUser() already performs, never changing what usersSkipped/
     * notificationsFailed themselves mean or count. preferenceBlocked is
     * the subset of notificationsSkipped caused specifically by
     * notificationEngine.send()'s own preference gate (see processUser's
     * sendResults.length===0 branch); frequencyBlocked/cooldownBlocked
     * are the subset of usersSkipped caused by THOSE specific gates
     * (as opposed to a failed condition); deliveryFailed is the subset
     * of notificationsFailed caused by notificationEngine.send() itself
     * throwing, as opposed to a post-send state-write failure.
     */
    preferenceBlockedCount: number;
    frequencyBlockedCount: number;
    cooldownBlockedCount: number;
    deliveryFailedCount: number;
    errors: string[];
    warnings: string[];
    /**
     * Per-user detail — ALWAYS populated for dry runs (that's the whole
     * point of a preview), OPTIONALLY populated for live runs up to
     * `maxDetailedOutcomes` (see ExecuteRuleOptions) purely for small-
     * scale debugging. Omitted (undefined) once that cap is exceeded —
     * counts above still flow into the aggregate fields above regardless;
     * only the DETAIL array is capped, to keep memory bounded against a
     * 100,000+-user audience.
     */
    outcomes?: UserExecutionOutcome[];
};

// ── Per-user outcome ──────────────────────────────────────────────────────
//
// "retryable" and the retryCount/retryAt fields are ARCHITECTURE ONLY —
// per the brief, "Do NOT implement retries yet." No code path in Part 3
// ever produces status:"retryable" or populates retryCount/retryAt with a
// real value; they exist so a future retry-implementing part can start
// populating them without a type change here. Classifying a real failure
// as "transient, worth retrying" vs "permanent" requires actual error-
// taxonomy logic that's explicitly out of scope — inventing a fake
// heuristic now would be exactly the kind of shortcut this brief rules out.
export type UserExecutionOutcomeStatus = "sent" | "matched" | "skipped" | "failed" | "retryable";

/**
 * Part 6: a STRUCTURED classification alongside the existing free-text
 * `reason` — added because reliably counting preferenceBlocked/
 * frequencyBlocked/cooldownBlocked/deliveryFailed for the execution
 * report requires something more reliable than string-matching a
 * human-readable message. The free-text `reason` is unchanged and still
 * exists for display; this is purely additive.
 */
export type UserExecutionReasonCode =
    | "condition_not_met"
    | "cooldown_active"
    | "frequency_limit_reached"
    | "no_content_available"
    | "preference_blocked"
    | "send_error"
    | "state_write_error";

export type UserExecutionOutcome = {
    userId: string;
    status: UserExecutionOutcomeStatus;
    reason?: string;
    /** Part 6: see UserExecutionReasonCode's own doc. */
    reasonCode?: UserExecutionReasonCode;
    /** Architecture-only — see file header. Always undefined in Part 3. */
    retryCount?: number;
    /** Architecture-only — see file header. Always undefined in Part 3. */
    retryAt?: Date | null;
    /**
     * Populated only when the run reached content-selection successfully
     * (status "matched" or "sent") AND detail-capture is active for this
     * outcome (dry run, or under the live-run detail cap). Lets a dry run
     * show "here's exactly what would have been sent" without the engine
     * needing a second code path to build the same payload twice.
     */
    payloadPreview?: NotificationPayload;
};

// ── Execution options ─────────────────────────────────────────────────────
export type ExecuteRuleOptions = {
    /** Simulates the full pipeline through content-selection, but never calls notificationEngine.send() and never writes to AutomationUserState or AutomationExecution. Default false. */
    dryRun?: boolean;
    /** How many user IDs to batch-fetch AutomationUserState for in one query. Default 100 — see engine.ts's header for why this is separate from `concurrency`. */
    batchSize?: number;
    /** How many users within a batch are gated/sent concurrently. Default 20. */
    concurrency?: number;
    /** Caps how many UserExecutionOutcome entries (incl. payload previews) are retained in the returned result's `outcomes` array. Default: unlimited for dry runs, 0 for live runs (aggregate counts only) unless explicitly raised. */
    maxDetailedOutcomes?: number;
    /** Part 6: an externally-supplied executionId (Part 4's ExecutionContext.executionId) to persist alongside this run, letting automation/api/executionReport.ts find this exact AutomationExecution row later. Auto-generated if omitted — every execution still gets a real, persisted id either way. */
    executionId?: string;
    /** Part 6: where this execution was invoked from (Part 4's TriggerSource) — persisted into AutomationExecution.triggerType. Defaults to "manual", identical to every caller's behavior before this option existed. */
    triggerSource?: string;
    /** Part 6: the Part 5 scheduling window this execution represents, if invoked by the scheduler. Defaults to null. */
    windowKey?: string | null;
    /**
     * Part 6: when provided, audience resolution is SKIPPED entirely and
     * exactly these user IDs are used as the candidate pool instead —
     * every other gate (conditions, cooldown, frequency, content
     * selection) still applies normally to each of them. This is what
     * lets automation/api/retry.ts target ONLY a past execution's failed
     * users without reimplementing executeRule()'s per-user pipeline
     * (which would be exactly the duplicated logic this brief forbids).
     * Never used by any existing caller — entirely additive.
     */
    audienceOverride?: string[];
};

// ── Rule validation ──────────────────────────────────────────────────────
export type RuleValidationResult = {
    valid: boolean;
    errors: string[];
};