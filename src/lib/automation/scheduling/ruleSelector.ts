// src/lib/automation/scheduling/ruleSelector.ts
//
// FoodKnock Automation Engine — Rule Selector (Part 5 of 6).
//
// "Efficiently load only candidate rules. Avoid scanning everything
// unnecessarily. Think for 100k+ users." Worth being precise about what
// scale concern actually applies where: rules themselves number in the
// dozens at most — the 100k+-USER concern is entirely about each rule's
// AUDIENCE, already solved (batched, worker-pooled) by Parts 1-4 and
// completely untouched here. This file's only job is making the rule
// query itself as targeted as possible — not loading rules that could
// never be due before even checking them.
//
// One query, with BOTH filters applied at the database level:
// enabled:true (same condition loadEnabledRules() already uses) AND
// schedule.type being one the scheduler actually has a
// WindowScheduleResolver for. "manual"/"cron"/"interval" rules are never
// polled by the scheduler at all (they're not meant to be — "manual" is
// explicitly invoked via runner.runOne(), not discovered), so excluding
// them at the query level means one fewer round of hydrating documents
// that could never have matched anyway.
//
// Reuses ruleEngine.ts's own toRuleDefinition() conversion (exported for
// this purpose, the same "export an existing function rather than
// duplicate it" pattern used for engine.ts's runWithConcurrency in Part 4)
// — this file never reimplements that mapping.

import { connectDB } from "@/lib/db";
import AutomationRule from "@/models/AutomationRule";
import { toRuleDefinition } from "../ruleEngine";
import type { RawRuleDoc } from "../ruleEngine";
import { scheduleResolverRegistry } from "./scheduleResolver";
import type { AutomationRuleDefinition, AutomationScheduleType } from "../types";

const ALL_NAMED_SCHEDULE_TYPES: AutomationScheduleType[] = [
    "immediate", "hourly", "daily", "weekly", "monthly",
    "specific_time", "multiple_times_per_day", "specific_days",
];

/** Every schedule.type with a registered WindowScheduleResolver — computed fresh each call (cheap: iterates a fixed, small list) rather than cached, so a future scheduleResolverRegistry.register() call elsewhere takes effect immediately without this file needing to know about it. */
function getSchedulableTypes(): AutomationScheduleType[] {
    return ALL_NAMED_SCHEDULE_TYPES.filter((t) => scheduleResolverRegistry.get(t) !== undefined);
}

/**
 * Loads enabled rules whose schedule type the scheduler can actually
 * evaluate, in one query with both conditions applied at the database
 * level. Active-window filtering (activeFrom/activeUntil) still happens
 * in application code via isRuleActiveNow() — same as Parts 1-3 — since
 * that needs "now", which doesn't belong baked into a static query.
 */
export async function selectSchedulableRules(): Promise<AutomationRuleDefinition[]> {
    await connectDB();

    const schedulableTypes = getSchedulableTypes();
    if (schedulableTypes.length === 0) return [];

    const docs = (await AutomationRule.find({
        enabled: true,
        "schedule.type": { $in: schedulableTypes },
    }).lean()) as unknown as RawRuleDoc[];

    return docs.map(toRuleDefinition);
}