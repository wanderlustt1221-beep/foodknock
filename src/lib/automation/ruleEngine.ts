// src/lib/automation/ruleEngine.ts
//
// FoodKnock Automation Engine — rule lifecycle (Part 1 of 6).
//
// Everything about a rule's own validity lives here: loading it from the
// database, validating its shape against the Notification Engine's own
// vocabulary (category/priority/channels — reused, not redefined; see
// types.ts), and checking whether "now" falls within its activation
// window. engine.ts calls into this module rather than touching
// AutomationRule directly — the same separation notifications/engine.ts
// keeps from its templates and providers.

import { connectDB } from "@/lib/db";
import AutomationRule from "@/models/AutomationRule";
import type {
    NotificationCategory,
    NotificationChannel,
    NotificationPriority,
} from "@/lib/notifications/types";
import type { MarketingSlot } from "@/lib/notifications/marketing/types";
import { isRuleDue } from "./scheduler";
import type { AutomationRuleDefinition, RuleValidationResult } from "./types";

const VALID_CATEGORIES: NotificationCategory[] = [
    "order_update", "offer", "reward", "lunch_deal", "evening_deal",
    "festival", "flash_sale", "price_drop", "system", "general",
];
const VALID_PRIORITIES: NotificationPriority[] = ["low", "normal", "high", "urgent"];
const VALID_CHANNELS: NotificationChannel[] = ["push", "email", "whatsapp", "sms"];

/** Exported (Part 5): ruleSelector.ts reuses this exact conversion for its own, more narrowly-filtered query rather than duplicating it. */
export type RawRuleDoc = {
    _id: { toString(): string };
    name: string;
    slug: string;
    enabled: boolean;
    trigger: { type: string; config?: Record<string, unknown> };
    audience: { type: string; config?: Record<string, unknown> };
    schedule: { type: string; config?: Record<string, unknown> };
    conditions: Array<{ field: string; operator: string; value?: unknown }>;
    category: string;
    priority: string;
    channels: string[];
    libraryCategory: string;
    maxPerHour?: number | null;
    maxPerDay: number;
    cooldownHours: number;
    categoryCooldownHours?: number | null;
    campaignCooldownHours?: number | null;
    categoryMaxPerDay?: number | null;
    campaignMaxPerDay?: number | null;
    maxLifetime?: number | null;
    activeFrom: Date | null;
    activeUntil: Date | null;
    timezone: string;
    metadata: Record<string, unknown>;
};

/** Converts a raw Mongoose lean() document into the TS-level AutomationRuleDefinition shape. */
/** Exported (Part 5): see RawRuleDoc's comment just above — same reuse rationale. */
export function toRuleDefinition(doc: RawRuleDoc): AutomationRuleDefinition {
    return {
        id: doc._id.toString(),
        slug: doc.slug,
        name: doc.name,
        enabled: doc.enabled,
        trigger: { type: doc.trigger.type as AutomationRuleDefinition["trigger"]["type"], config: doc.trigger.config },
        conditions: (doc.conditions ?? []) as AutomationRuleDefinition["conditions"],
        audience: { type: doc.audience.type as AutomationRuleDefinition["audience"]["type"], config: doc.audience.config },
        schedule: { type: doc.schedule.type as AutomationRuleDefinition["schedule"]["type"], config: doc.schedule.config },
        category: doc.category as NotificationCategory,
        priority: doc.priority as NotificationPriority,
        libraryCategory: doc.libraryCategory as MarketingSlot,
        maxPerHour: doc.maxPerHour ?? null,
        maxPerDay: doc.maxPerDay,
        cooldownHours: doc.cooldownHours,
        categoryCooldownHours: doc.categoryCooldownHours ?? null,
        campaignCooldownHours: doc.campaignCooldownHours ?? null,
        categoryMaxPerDay: doc.categoryMaxPerDay ?? null,
        campaignMaxPerDay: doc.campaignMaxPerDay ?? null,
        maxLifetime: doc.maxLifetime ?? null,
        channels: doc.channels as NotificationChannel[],
        activeFrom: doc.activeFrom,
        activeUntil: doc.activeUntil,
        timezone: doc.timezone,
        metadata: doc.metadata ?? {},
    };
}

/** Loads one rule by slug. Returns null if not found — callers decide how to handle that. */
export async function loadRule(slug: string): Promise<AutomationRuleDefinition | null> {
    await connectDB();
    const doc = await AutomationRule.findOne({ slug }).lean() as unknown as RawRuleDoc | null;
    return doc ? toRuleDefinition(doc) : null;
}

/** Loads every enabled rule — the eventual scheduler's primary query. Unused by anything in Part 1 (no scheduler exists yet), but the loading capability itself is part of the foundation. */
export async function loadEnabledRules(): Promise<AutomationRuleDefinition[]> {
    await connectDB();
    const docs = await AutomationRule.find({ enabled: true }).lean() as unknown as RawRuleDoc[];
    return docs.map(toRuleDefinition);
}

/**
 * Validates a rule's shape against the Notification Engine's own
 * vocabulary. Does NOT validate trigger/audience/schedule `config`
 * contents (those mechanisms aren't implemented yet — see scheduler.ts /
 * audienceResolver.ts) — only that `category`/`priority`/`channels` are
 * values the engine actually understands, since those flow straight into
 * a NotificationPayload and a typo there would silently fall back to
 * applyBranding()'s defaults rather than erroring loudly.
 */
export function validateRule(rule: AutomationRuleDefinition): RuleValidationResult {
    const errors: string[] = [];

    if (!rule.name?.trim()) errors.push("name is required.");
    if (!rule.slug?.trim()) errors.push("slug is required.");

    if (!VALID_CATEGORIES.includes(rule.category)) {
        errors.push(`category "${rule.category}" is not a recognized NotificationCategory.`);
    }
    if (!VALID_PRIORITIES.includes(rule.priority)) {
        errors.push(`priority "${rule.priority}" is not a recognized NotificationPriority.`);
    }
    if (!rule.channels?.length) {
        errors.push("channels must include at least one channel.");
    } else {
        for (const channel of rule.channels) {
            if (!VALID_CHANNELS.includes(channel)) {
                errors.push(`channel "${channel}" is not a recognized NotificationChannel.`);
            }
        }
    }

    if (!rule.libraryCategory?.trim()) {
        errors.push("libraryCategory is required (must match a MarketingSlot).");
    }

    if (rule.maxPerDay < 0) errors.push("maxPerDay cannot be negative.");
    if (rule.cooldownHours < 0) errors.push("cooldownHours cannot be negative.");
    if (rule.maxPerHour !== null && rule.maxPerHour < 0) errors.push("maxPerHour cannot be negative.");
    if (rule.categoryCooldownHours !== null && rule.categoryCooldownHours < 0) errors.push("categoryCooldownHours cannot be negative.");
    if (rule.campaignCooldownHours !== null && rule.campaignCooldownHours < 0) errors.push("campaignCooldownHours cannot be negative.");
    if (rule.categoryMaxPerDay !== null && rule.categoryMaxPerDay < 0) errors.push("categoryMaxPerDay cannot be negative.");
    if (rule.campaignMaxPerDay !== null && rule.campaignMaxPerDay < 0) errors.push("campaignMaxPerDay cannot be negative.");
    if (rule.maxLifetime !== null && rule.maxLifetime < 0) errors.push("maxLifetime cannot be negative.");

    if (rule.activeFrom && rule.activeUntil && rule.activeFrom.getTime() > rule.activeUntil.getTime()) {
        errors.push("activeFrom must be before activeUntil.");
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Whether a rule is enabled at all. Split out from isRuleActiveNow (Part
 * 2) so "Check Enabled" and "Check Active Window" are two independently
 * testable, independently replaceable pipeline stages, matching the
 * brief's explicit pipeline diagram — previously this was folded into
 * isRuleActiveNow's first line; that line moves here unchanged in effect,
 * just promoted to its own named unit.
 */
export function isRuleEnabled(rule: AutomationRuleDefinition): boolean {
    return rule.enabled;
}

/**
 * Whether `now` falls within the rule's activation window. A rule with no
 * activeFrom/activeUntil is always active (the window is unbounded on
 * whichever side is unset) — this is about the rule's own validity
 * window, not the same thing as the Scheduler's "is it due right now"
 * (see scheduler.ts) — a rule can be active all year and still only be
 * due at noon on Tuesdays once a real scheduler exists.
 *
 * No longer checks `enabled` itself (Part 1 did, inline) — that's now
 * isRuleEnabled()'s sole responsibility, checked as its own pipeline step
 * by engine.ts before this one runs.
 */
export function isRuleActiveNow(rule: AutomationRuleDefinition, now: Date = new Date()): boolean {
    if (rule.activeFrom && now.getTime() < rule.activeFrom.getTime()) return false;
    if (rule.activeUntil && now.getTime() > rule.activeUntil.getTime()) return false;
    return true;
}

/**
 * Part 3's "Load Due Rules" pipeline step. Composes three EXISTING
 * checks — loadEnabledRules() (DB query), isRuleActiveNow() (this file),
 * isRuleDue() (scheduler.ts) — none of which are reimplemented here. A
 * rule is "due" only if it's enabled (already guaranteed by
 * loadEnabledRules' own query), within its activation window, AND its
 * schedule says it's due right now.
 *
 * Today this always returns an empty array in practice: scheduler.ts has
 * no registered evaluator for "cron"/"interval" (only "manual", which
 * always answers isDue() => false) — there is genuinely no scheduling
 * mechanism wired up yet, exactly as every part through Part 3 has
 * required ("NO cron, NO timers... only scheduler interfaces"). This
 * function is real, working, and correct; it simply has nothing to find
 * until a future part registers a real ScheduleEvaluator.
 */
export async function loadDueRules(now: Date = new Date()): Promise<AutomationRuleDefinition[]> {
    const enabledRules = await loadEnabledRules();
    return enabledRules.filter((rule) => isRuleActiveNow(rule, now) && isRuleDue(rule.schedule, now));
}