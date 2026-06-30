// src/lib/automation/engine.ts
//
// FoodKnock Automation Engine — orchestration (Part 1 + 2 + 3 + 6 of 6).
//
//   AutomationRule  →  Automation Engine  →  Notification Engine  →  Delivery Providers
//
// ── PART 6 CHANGES, AT A GLANCE ───────────────────────────────────────────
// All strictly additive — every existing field, every existing return
// value's meaning, and every existing caller's behavior (any call that
// doesn't pass the new options) is unchanged.
//   1. executionId/triggerSource/windowKey: threaded through from
//      ExecuteRuleOptions into AutomationExecutionResult and persisted —
//      needed because automation/api/executionReport.ts must be able to
//      retrieve a report for a PAST execution from a LATER, separate
//      serverless invocation (Vercel Hobby is stateless; nothing
//      in-memory survives between invocations). Auto-generated/defaulted
//      when not supplied, so direct callers (Parts 1-3's own tests,
//      schedulerRunner.ts) get identical values to before this existed.
//   2. audienceOverride: when supplied, resolveAudience() is skipped
//      entirely and exactly those user IDs become the candidate pool —
//      every other gate still applies normally. This is what lets
//      automation/api/retry.ts target only a past execution's failed
//      users without reimplementing this file's per-user pipeline.
//   3. reasonCode on UserExecutionOutcome + four new granular counters
//      (preferenceBlockedCount/frequencyBlockedCount/cooldownBlockedCount/
//      deliveryFailedCount): computed from the EXACT SAME classification
//      processUser() already performs at each existing return point —
//      no new branches, no changed behavior, just one more field set at
//      each place a decision was already being made.
//
// Delivery is still 100% the Notification Engine's job — this file still
// never imports a DeliveryProvider, never touches PushSubscription, never
// builds a wire payload. NotificationLog is still written automatically
// and exclusively by notificationEngine.send()'s own internal hook — this
// file does nothing extra for it, by design (see notifications/logger.ts).

import { connectDB } from "@/lib/db";
import { notificationEngine } from "@/lib/notifications";
import AutomationUserState from "@/models/AutomationUserState";
import { loadRule, validateRule, isRuleEnabled, isRuleActiveNow } from "./ruleEngine";
import { resolveAudience } from "./audienceResolver";
import { evaluateConditions } from "./conditions";
import { checkAllCooldowns, type CooldownDimension } from "./cooldown";
import {
    checkAllFrequencyLimits,
    nextWindowState,
    FREQUENCY_WINDOW_MS,
    type FrequencyDimension,
    type FrequencyState,
} from "./frequencyLimiter";
import { selectContentForRule } from "./rotation";
import { logAutomationExecution } from "./logger";
import type {
    AutomationConditionContext,
    AutomationExecutionResult,
    AutomationRuleDefinition,
    ExecuteRuleOptions,
    UserExecutionOutcome,
} from "./types";

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_CONCURRENCY = 20;

type DimensionStateDoc = {
    lastSentAt?: Date | null;
    hourlyCount?: number;
    hourlyWindowStart?: Date | null;
    dailyCount?: number;
    dailyWindowStart?: Date | null;
    weeklyCount?: number;
    weeklyWindowStart?: Date | null;
    monthlyCount?: number;
    monthlyWindowStart?: Date | null;
    lifetimeCount?: number;
};

type DimensionMap = Map<string, DimensionStateDoc> | Record<string, DimensionStateDoc> | undefined;

type AutomationUserStateDoc = {
    user: { toString(): string };
    lastSent?: Date | null;
    hourlyCount?: number;
    hourlyWindowStart?: Date | null;
    dailyCount?: number;
    dailyWindowStart?: Date | null;
    weeklyCount?: number;
    weeklyWindowStart?: Date | null;
    monthlyCount?: number;
    monthlyWindowStart?: Date | null;
    lifetimeCount?: number;
    history?: Array<{ ruleSlug: string; category: string | null; sentAt: Date }>;
    perRule?: DimensionMap;
    perCategory?: DimensionMap;
    perCampaign?: DimensionMap;
};

function getDimensionState(map: DimensionMap, key: string): DimensionStateDoc | undefined {
    if (!map) return undefined;
    if (map instanceof Map) return map.get(key);
    return (map as Record<string, DimensionStateDoc>)[key];
}

function toFrequencyState(doc: DimensionStateDoc | undefined): FrequencyState | undefined {
    if (!doc) return undefined;
    return {
        hourlyCount: doc.hourlyCount ?? 0,
        hourlyWindowStart: doc.hourlyWindowStart ?? null,
        dailyCount: doc.dailyCount ?? 0,
        dailyWindowStart: doc.dailyWindowStart ?? null,
        weeklyCount: doc.weeklyCount ?? 0,
        weeklyWindowStart: doc.weeklyWindowStart ?? null,
        monthlyCount: doc.monthlyCount ?? 0,
        monthlyWindowStart: doc.monthlyWindowStart ?? null,
        lifetimeCount: doc.lifetimeCount ?? 0,
    };
}

/** See engine.ts's header — only meaningfully different from `rule.slug` once an admin opts into cross-rule grouping via metadata.campaignId. */
function campaignKeyFor(rule: AutomationRuleDefinition): string {
    const explicit = rule.metadata?.campaignId;
    return typeof explicit === "string" && explicit.trim() ? explicit : rule.slug;
}

function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

/**
 * Bounded-concurrency worker pool. Unlike "split into fixed chunks and
 * Promise.all each chunk" (Part 1/2's approach), this keeps exactly
 * `concurrency` workers continuously busy — a chunk-based approach stalls
 * on its single slowest item before the next chunk can start; this
 * doesn't. Genuinely simple (no external queue/library, per the brief),
 * genuinely correct (verified at runtime — see the response notes).
 *
 * Exported (Part 4): src/lib/automation/runner/batchRunner.ts reuses this
 * EXACT function rather than reimplementing its own worker pool, per
 * Part 4's explicit "Reuse worker pool" requirement.
 */
export async function runWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;

    async function runWorker(): Promise<void> {
        while (true) {
            const currentIndex = nextIndex++;
            if (currentIndex >= items.length) return;
            results[currentIndex] = await worker(items[currentIndex]);
        }
    }

    const workerCount = Math.max(1, Math.min(concurrency, items.length));
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
    return results;
}

function generateExecutionId(): string {
    return crypto.randomUUID();
}

class AutomationEngine {
    /**
     * Runs one rule against its resolved audience (or, if
     * `options.audienceOverride` is supplied, against exactly that list
     * instead — see file header and types.ts's ExecuteRuleOptions doc).
     * Never throws — every failure path is caught and reflected in the
     * returned result's status/errors, since callers (SchedulerRunner,
     * the Runner layer, automation/api/, processing many rules) must
     * never have one rule's failure take down the run.
     */
    async executeRule(ruleSlug: string, options: ExecuteRuleOptions = {}): Promise<AutomationExecutionResult> {
        const startedAt = new Date();
        const dryRun = options.dryRun ?? false;
        const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
        const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
        const maxDetailedOutcomes = options.maxDetailedOutcomes ?? (dryRun ? Infinity : 0);
        const executionId = options.executionId ?? generateExecutionId();
        const triggerSource = options.triggerSource ?? "manual";
        const windowKey = options.windowKey ?? null;

        try {
            const rule = await loadRule(ruleSlug);
            if (!rule) {
                return this.finalize(ruleSlug, startedAt, dryRun, executionId, triggerSource, windowKey, {
                    status: "failed", usersEvaluated: 0, usersMatched: 0, usersSkipped: 0,
                    notificationsSent: 0, notificationsSkipped: 0, notificationsFailed: 1,
                    preferenceBlockedCount: 0, frequencyBlockedCount: 0, cooldownBlockedCount: 0, deliveryFailedCount: 0,
                    errors: [`No rule found for slug "${ruleSlug}".`], warnings: [], outcomes: [],
                });
            }

            const validation = validateRule(rule);
            if (!validation.valid) {
                return this.finalize(rule.slug, startedAt, dryRun, executionId, triggerSource, windowKey, {
                    status: "failed", usersEvaluated: 0, usersMatched: 0, usersSkipped: 0,
                    notificationsSent: 0, notificationsSkipped: 0, notificationsFailed: validation.errors.length,
                    preferenceBlockedCount: 0, frequencyBlockedCount: 0, cooldownBlockedCount: 0, deliveryFailedCount: 0,
                    errors: validation.errors, warnings: [], outcomes: [],
                }, rule.id);
            }

            if (!isRuleEnabled(rule)) {
                return this.finalize(rule.slug, startedAt, dryRun, executionId, triggerSource, windowKey, {
                    status: "skipped", usersEvaluated: 0, usersMatched: 0, usersSkipped: 0,
                    notificationsSent: 0, notificationsSkipped: 0, notificationsFailed: 0,
                    preferenceBlockedCount: 0, frequencyBlockedCount: 0, cooldownBlockedCount: 0, deliveryFailedCount: 0,
                    errors: [], warnings: ["Rule is disabled."], outcomes: [],
                }, rule.id);
            }

            if (!isRuleActiveNow(rule)) {
                return this.finalize(rule.slug, startedAt, dryRun, executionId, triggerSource, windowKey, {
                    status: "skipped", usersEvaluated: 0, usersMatched: 0, usersSkipped: 0,
                    notificationsSent: 0, notificationsSkipped: 0, notificationsFailed: 0,
                    preferenceBlockedCount: 0, frequencyBlockedCount: 0, cooldownBlockedCount: 0, deliveryFailedCount: 0,
                    errors: [], warnings: ["Rule is outside its active window."], outcomes: [],
                }, rule.id);
            }

            // Part 6: audienceOverride bypasses resolveAudience() entirely
            // — see file header and ExecuteRuleOptions' doc. Everything
            // from here on treats the override list exactly like a
            // normally-resolved audience.
            const audience = options.audienceOverride ?? await resolveAudience(rule.audience);
            if (audience.length === 0) {
                return this.finalize(rule.slug, startedAt, dryRun, executionId, triggerSource, windowKey, {
                    status: "skipped", usersEvaluated: 0, usersMatched: 0, usersSkipped: 0,
                    notificationsSent: 0, notificationsSkipped: 0, notificationsFailed: 0,
                    preferenceBlockedCount: 0, frequencyBlockedCount: 0, cooldownBlockedCount: 0, deliveryFailedCount: 0,
                    errors: [], warnings: ["Resolved audience was empty."], outcomes: [],
                }, rule.id);
            }

            let usersMatched = 0;
            let usersSkipped = 0;
            let notificationsSent = 0;
            let notificationsSkipped = 0;
            let notificationsFailed = 0;
            let preferenceBlockedCount = 0;
            let frequencyBlockedCount = 0;
            let cooldownBlockedCount = 0;
            let deliveryFailedCount = 0;
            const errors: string[] = [];
            const warnings: string[] = [];
            const detailedOutcomes: UserExecutionOutcome[] = [];

            for (const batch of chunkArray(audience, batchSize)) {
                // ── N+1 fix: ONE query for the whole batch, not one per user ──
                await connectDB();
                const stateDocs = (await AutomationUserState.find({ user: { $in: batch } }).lean()) as unknown as AutomationUserStateDoc[];
                const stateByUser = new Map(stateDocs.map((doc) => [doc.user.toString(), doc]));

                const outcomes = await runWithConcurrency(batch, concurrency, async (userId) => {
                    try {
                        return await this.processUser(rule, userId, stateByUser.get(userId), dryRun);
                    } catch (err) {
                        return {
                            userId,
                            status: "failed" as const,
                            reason: err instanceof Error ? err.message : String(err),
                            reasonCode: "send_error" as const,
                        };
                    }
                });

                for (const outcome of outcomes) {
                    switch (outcome.status) {
                        case "sent":
                            usersMatched++;
                            notificationsSent++;
                            break;
                        case "matched":
                            usersMatched++;
                            notificationsSkipped++;
                            if (outcome.reasonCode === "preference_blocked") preferenceBlockedCount++;
                            break;
                        case "skipped":
                            usersSkipped++;
                            if (outcome.reasonCode === "frequency_limit_reached") frequencyBlockedCount++;
                            if (outcome.reasonCode === "cooldown_active") cooldownBlockedCount++;
                            break;
                        case "failed":
                        case "retryable":
                            notificationsFailed++;
                            if (outcome.reasonCode === "send_error") deliveryFailedCount++;
                            errors.push(`User ${outcome.userId}: ${outcome.reason ?? "unknown error"}`);
                            break;
                    }
                    if (detailedOutcomes.length < maxDetailedOutcomes) {
                        detailedOutcomes.push(outcome);
                    }
                }
            }

            const status: AutomationExecutionResult["status"] =
                notificationsFailed > 0 ? (notificationsSent > 0 ? "partial" : "failed") : "success";

            return this.finalize(rule.slug, startedAt, dryRun, executionId, triggerSource, windowKey, {
                status,
                usersEvaluated: audience.length,
                usersMatched,
                usersSkipped,
                notificationsSent,
                notificationsSkipped,
                notificationsFailed,
                preferenceBlockedCount,
                frequencyBlockedCount,
                cooldownBlockedCount,
                deliveryFailedCount,
                errors,
                warnings,
                outcomes: detailedOutcomes,
            }, rule.id);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return this.finalize(ruleSlug, startedAt, dryRun, executionId, triggerSource, windowKey, {
                status: "failed", usersEvaluated: 0, usersMatched: 0, usersSkipped: 0,
                notificationsSent: 0, notificationsSkipped: 0, notificationsFailed: 1,
                preferenceBlockedCount: 0, frequencyBlockedCount: 0, cooldownBlockedCount: 0, deliveryFailedCount: 0,
                errors: [message], warnings: [], outcomes: [],
            });
        }
    }

    /**
     * Gates one user and, in live mode, sends + records state. SHARED
     * between live and dry runs — every step through content-selection is
     * identical for both; the two modes only diverge at the final
     * send+record step. `preFetchedState` comes from executeRule's
     * batch query — this function never queries AutomationUserState
     * itself for the READ side, only for the WRITE side (recordExecutionForUser),
     * and only when a send is about to actually happen.
     */
    private async processUser(
        rule: AutomationRuleDefinition,
        userId: string,
        preFetchedState: AutomationUserStateDoc | undefined,
        dryRun: boolean
    ): Promise<UserExecutionOutcome> {
        const campaignKey = campaignKeyFor(rule);
        const ruleState = getDimensionState(preFetchedState?.perRule, rule.slug);
        const categoryState = getDimensionState(preFetchedState?.perCategory, rule.category);
        const campaignState = getDimensionState(preFetchedState?.perCampaign, campaignKey);

        const context: AutomationConditionContext = {
            now: new Date(),
            automationState: {
                lastSent: preFetchedState?.lastSent ?? null,
                perRule: ruleState ?? null,
            },
        };

        if (!(await evaluateConditions(rule.conditions, context, userId))) {
            return { userId, status: "skipped", reason: "Did not match rule conditions.", reasonCode: "condition_not_met" };
        }

        const frequencyDimensions: FrequencyDimension[] = [
            { name: "rule", limits: { maxPerHour: rule.maxPerHour, maxPerDay: rule.maxPerDay, maxLifetime: rule.maxLifetime }, state: toFrequencyState(ruleState) },
            { name: "category", limits: { maxPerDay: rule.categoryMaxPerDay }, state: toFrequencyState(categoryState) },
            { name: "campaign", limits: { maxPerDay: rule.campaignMaxPerDay }, state: toFrequencyState(campaignState) },
            { name: "global", limits: {}, state: toFrequencyState(preFetchedState as unknown as DimensionStateDoc) },
        ];
        const frequencyResult = checkAllFrequencyLimits(frequencyDimensions);
        if (!frequencyResult.allowed) {
            return { userId, status: "skipped", reason: frequencyResult.reason, reasonCode: "frequency_limit_reached" };
        }

        const cooldownDimensions: CooldownDimension[] = [
            { name: "rule", cooldownHours: rule.cooldownHours, state: ruleState ? { lastSentAt: ruleState.lastSentAt ?? null } : undefined },
            { name: "category", cooldownHours: rule.categoryCooldownHours, state: categoryState ? { lastSentAt: categoryState.lastSentAt ?? null } : undefined },
            { name: "campaign", cooldownHours: rule.campaignCooldownHours, state: campaignState ? { lastSentAt: campaignState.lastSentAt ?? null } : undefined },
            { name: "global", cooldownHours: null, state: preFetchedState?.lastSent ? { lastSentAt: preFetchedState.lastSent } : undefined },
        ];
        const cooldownResult = checkAllCooldowns(cooldownDimensions);
        if (!cooldownResult.allowed) {
            return { userId, status: "skipped", reason: cooldownResult.reason, reasonCode: "cooldown_active" };
        }

        const payload = await selectContentForRule(rule, userId);
        if (!payload) {
            return { userId, status: "skipped", reason: "No marketing content available for this slot.", reasonCode: "no_content_available" };
        }

        if (dryRun) {
            // Dry run's terminal state — everything above is identical to
            // a live run; this is the ONLY branch that diverges.
            return { userId, status: "matched", reason: "Dry run — not delivered.", payloadPreview: payload };
        }

        // ── Notification Engine — the one call that actually delivers ────
        let sendResults;
        try {
            sendResults = await notificationEngine.send(rule.channels, { userId }, payload);
        } catch (err) {
            return {
                userId,
                status: "failed",
                reason: `Send failed: ${err instanceof Error ? err.message : String(err)}`,
                reasonCode: "send_error",
            };
        }

        // notificationEngine.send() returns an EMPTY array when its own
        // preference gate silently blocks delivery (the user has this
        // payload's category disabled — see notifications/engine.ts's
        // send(), which returns [] before attempting any channel). That's
        // not a failure and not automation's decision to make — but it IS
        // a real "matched, nothing delivered" outcome distinct from
        // "delivered". Recording a send here would be wrong twice over:
        // it would falsely count as notificationsSent, AND it would write
        // cooldown/frequency bookkeeping for a notification that never
        // actually reached the user, incorrectly suppressing a future
        // attempt that might succeed (e.g. if they re-enable the category).
        if (sendResults.length === 0) {
            return {
                userId,
                status: "matched",
                reason: "Notification Engine declined delivery (recipient has this category disabled).",
                reasonCode: "preference_blocked",
                payloadPreview: payload,
            };
        }

        // The send already succeeded — a bookkeeping failure here must
        // NEVER retroactively turn a successful delivery into a "failed"
        // outcome. Isolated in its own try/catch, logged as a warning via
        // the outcome's reason rather than propagated.
        try {
            await this.recordExecutionForUser(rule, userId, campaignKey, preFetchedState, payload.category ?? rule.category, payload.campaignId);
        } catch (err) {
            console.error(`AUTOMATION_USER_STATE_WRITE_ERROR (user ${userId}, rule ${rule.slug}):`, err);
            return {
                userId,
                status: "sent",
                reason: "Delivered, but the automation state update failed (cooldown/frequency bookkeeping may be stale for this user).",
                reasonCode: "state_write_error",
            };
        }

        return { userId, status: "sent" };
    }

    /**
     * Writes AutomationUserState after a successful send — across all
     * three dimensions (rule/category/campaign) plus the global snapshot,
     * in ONE update query. Reuses `preFetchedState` (no redundant read —
     * the N+1 fix applies here too, not just to the gating side) to
     * compute each dimension's next window state.
     */
    private async recordExecutionForUser(
        rule: AutomationRuleDefinition,
        userId: string,
        campaignKey: string,
        preFetchedState: AutomationUserStateDoc | undefined,
        category: string | undefined,
        campaignId: string | undefined
    ): Promise<void> {
        const now = new Date();

        const advance = (doc: DimensionStateDoc | undefined) => ({
            hourly: nextWindowState(doc?.hourlyCount ?? 0, doc?.hourlyWindowStart ?? null, FREQUENCY_WINDOW_MS.HOUR_MS, now),
            daily: nextWindowState(doc?.dailyCount ?? 0, doc?.dailyWindowStart ?? null, FREQUENCY_WINDOW_MS.DAY_MS, now),
            weekly: nextWindowState(doc?.weeklyCount ?? 0, doc?.weeklyWindowStart ?? null, FREQUENCY_WINDOW_MS.WEEK_MS, now),
            monthly: nextWindowState(doc?.monthlyCount ?? 0, doc?.monthlyWindowStart ?? null, FREQUENCY_WINDOW_MS.MONTH_MS, now),
            lifetime: (doc?.lifetimeCount ?? 0) + 1,
        });

        const ruleNext = advance(getDimensionState(preFetchedState?.perRule, rule.slug));
        const categoryNext = advance(getDimensionState(preFetchedState?.perCategory, rule.category));
        const campaignNext = advance(getDimensionState(preFetchedState?.perCampaign, campaignKey));
        const globalNext = advance(preFetchedState as unknown as DimensionStateDoc);

        const toDoc = (next: ReturnType<typeof advance>, lastSentAt: Date) => ({
            lastSentAt,
            hourlyCount: next.hourly.count,
            hourlyWindowStart: next.hourly.windowStart,
            dailyCount: next.daily.count,
            dailyWindowStart: next.daily.windowStart,
            weeklyCount: next.weekly.count,
            weeklyWindowStart: next.weekly.windowStart,
            monthlyCount: next.monthly.count,
            monthlyWindowStart: next.monthly.windowStart,
            lifetimeCount: next.lifetime,
        });

        const MAX_HISTORY = 50;
        const existingHistory = preFetchedState?.history ?? [];
        const nextHistory = [
            ...existingHistory,
            { ruleSlug: rule.slug, category: category ?? null, sentAt: now },
        ].slice(-MAX_HISTORY);

        await connectDB();
        await AutomationUserState.findOneAndUpdate(
            { user: userId },
            {
                $set: {
                    lastSent: now,
                    lastCategory: category ?? null,
                    lastCampaign: campaignId ?? null,
                    lastRule: rule.slug,

                    hourlyCount: globalNext.hourly.count,
                    hourlyWindowStart: globalNext.hourly.windowStart,
                    dailyCount: globalNext.daily.count,
                    dailyWindowStart: globalNext.daily.windowStart,
                    weeklyCount: globalNext.weekly.count,
                    weeklyWindowStart: globalNext.weekly.windowStart,
                    monthlyCount: globalNext.monthly.count,
                    monthlyWindowStart: globalNext.monthly.windowStart,
                    lifetimeCount: globalNext.lifetime,

                    [`perRule.${rule.slug}`]: toDoc(ruleNext, now),
                    [`perCategory.${rule.category}`]: toDoc(categoryNext, now),
                    [`perCampaign.${campaignKey}`]: toDoc(campaignNext, now),

                    history: nextHistory,
                },
            },
            { upsert: true }
        );
    }

    private async finalize(
        ruleSlug: string,
        startedAt: Date,
        dryRun: boolean,
        executionId: string,
        triggerSource: string,
        windowKey: string | null,
        partial: Omit<AutomationExecutionResult, "ruleSlug" | "dryRun" | "startedAt" | "finishedAt" | "durationMs" | "executionId" | "triggerSource" | "windowKey">,
        ruleId?: string
    ): Promise<AutomationExecutionResult> {
        const finishedAt = new Date();
        const result: AutomationExecutionResult = {
            ruleSlug,
            dryRun,
            executionId,
            triggerSource,
            windowKey,
            startedAt,
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            ...partial,
        };

        // Dry runs make ZERO database mutations — this is the one place
        // that guarantee is enforced for the execution-log side (the
        // send/state-write side already skips itself in processUser).
        if (ruleId && !dryRun) {
            await logAutomationExecution({ ruleId, triggerType: triggerSource, result });
        }

        return result;
    }
}

// Singleton — same hot-reload-safe pattern as notificationEngine.
const globalForAutomation = globalThis as unknown as {
    __fkAutomationEngine?: AutomationEngine;
};

export const automationEngine = globalForAutomation.__fkAutomationEngine ?? new AutomationEngine();

if (process.env.NODE_ENV !== "production") {
    globalForAutomation.__fkAutomationEngine = automationEngine;
}