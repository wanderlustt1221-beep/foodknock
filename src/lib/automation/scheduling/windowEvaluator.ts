// src/lib/automation/scheduling/windowEvaluator.ts
//
// FoodKnock Automation Engine — Window Evaluator (Part 5 of 6).
//
// Combines timeResolver.ts (what time is it, locally) with
// scheduleResolver.ts (what does this rule's schedule pattern mean) to
// answer the actual scheduling question: for this rule, at this instant,
// is there a due window — and if so, what's its stable identifier?
//
// ── THE MODEL: A WINDOW IS "OPEN" FROM ITS SCHEDULED TIME UNTIL CLAIMED ──
// Rather than a narrow "are we within N minutes of the exact time" check
// (fragile against irregular external cron intervals — cron-job.org's
// free tier, GitHub Actions, etc. don't all tick on a perfectly
// predictable schedule), a window is simply considered DUE from the
// moment its scheduled time arrives, and STAYS due until something
// claims it (executionLimiter.ts) or it becomes too stale to bother with
// (missedExecution.ts's lookback policy). This single model naturally
// covers BOTH normal on-time execution AND missed-execution recovery —
// a window checked 6 hours late because the external cron had a gap
// looks identical to one checked 2 minutes late; both are "due,
// unclaimed". There is no second mechanism for recovery — it falls out
// of this one rule for free.
//
// windowKey shape: "{localDateKey}#{HH:mm}" — uniform across every
// recurrence type (daily/weekly/monthly/specific_days all resolve to "a
// specific calendar date matched, fire at this time"), sufficient for
// hourly (24 distinct slots/day) and multiple-times-per-day (N
// configured slots/day) too. "immediate" is the one type with no stable
// key — see DueWindow.windowKey being null for that case.

import { getLocalParts, formatTimeSlot } from "./timeResolver";
import { scheduleResolverRegistry } from "./scheduleResolver";
import type { AutomationRuleDefinition } from "../types";

export type DueWindow = {
    /**
     * Stable identifier for this specific occurrence — null only for
     * "immediate" schedules, which have no fixed time-of-day and so no
     * meaningful per-occurrence key (see scheduleResolver.ts's
     * ImmediateResolver). A null windowKey means executionLimiter.ts's
     * window-claim step is skipped entirely for this due window; pacing
     * for "immediate" rules comes from the rule's own existing
     * cooldownHours/maxPerDay instead.
     */
    windowKey: string | null;
    /** The local instant this window was scheduled for — informational (logging, missed-execution age calculation), not itself a gating decision. */
    scheduledAt: Date;
};

/**
 * Resolves every due window for `rule` at `now`, given its OWN schedule
 * config and timezone. Usually returns 0 or 1 entries — multiple only for
 * "multiple_times_per_day" when more than one of that day's configured
 * slots has already arrived and none have been evaluated yet (e.g. a
 * rule checked once at the end of the day after being offline all day).
 *
 * Returns [] for any rule whose schedule.type has no registered
 * WindowScheduleResolver (e.g. "manual", "cron", "interval") — those
 * types are simply not this evaluator's concern; nothing here throws for
 * an intentionally-unscheduled rule.
 */
export function resolveDueWindows(rule: AutomationRuleDefinition, now: Date = new Date()): DueWindow[] {
    const resolver = scheduleResolverRegistry.get(rule.schedule.type);
    if (!resolver) return [];

    const configErrors = resolver.validateConfig(rule.schedule.config);
    if (configErrors.length > 0) {
        console.error(
            `WINDOW_EVALUATOR: rule "${rule.slug}" has an invalid "${rule.schedule.type}" schedule config — ${configErrors.join("; ")}`
        );
        return [];
    }

    const local = getLocalParts(now, rule.timezone);

    if (!resolver.usesTimeSlots) {
        // "immediate" — always due, no stable window key. See DueWindow's doc.
        return resolver.matchesRecurrencePattern(rule.schedule.config, local)
            ? [{ windowKey: null, scheduledAt: now }]
            : [];
    }

    if (!resolver.matchesRecurrencePattern(rule.schedule.config, local)) {
        return [];
    }

    const slots = resolver.getScheduledSlots(rule.schedule.config);
    const dueWindows: DueWindow[] = [];

    for (const slot of slots) {
        const hasArrived =
            local.hour > slot.hour || (local.hour === slot.hour && local.minute >= slot.minute);
        if (!hasArrived) continue;

        dueWindows.push({
            windowKey: `${local.dateKey}#${formatTimeSlot(slot.hour, slot.minute)}`,
            // Reconstructing the exact scheduled instant from local parts
            // would need its own timezone-aware Date construction; for
            // this field's informational purpose (age display, logging),
            // `now` is an accurate-enough stand-in for "around when this
            // was scheduled" — never used for gating decisions.
            scheduledAt: now,
        });
    }

    return dueWindows;
}