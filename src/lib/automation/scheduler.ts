// src/lib/automation/scheduler.ts
//
// FoodKnock Automation Engine — scheduling interface (Part 1 of 6).
//
// "Architecture only. NO cron implementation yet. NO node-cron. NO
// vercel cron. Only scheduler interfaces." This file contains exactly
// that and nothing more: a contract for "is this rule due to run right
// now", with NO registered implementation that can answer "yes" for a
// real cron expression. There is genuinely no scheduling mechanism here
// — nothing in this codebase calls isDue() yet, and nothing will fire a
// rule on a timer until a future part adds one (vercel cron hitting an
// API route that loads enabled "scheduled" rules and calls
// automationEngine.executeRule() for each due one — none of which exists
// yet, by design).
//
// The registry pattern mirrors audienceResolver.ts deliberately — both
// modules solve "pluggable strategy keyed by a type string", so they look
// the same on purpose, not by accident.

import type { AutomationSchedule, AutomationScheduleType } from "./types";

export interface ScheduleEvaluator {
    readonly type: AutomationScheduleType;
    /** Whether `schedule` is due to fire at `now`. No implementation answers `true` for "cron"/"interval" in Part 1. */
    isDue(schedule: AutomationSchedule, now: Date): boolean;
}

class SchedulerRegistry {
    private evaluators = new Map<AutomationScheduleType, ScheduleEvaluator>();

    register(evaluator: ScheduleEvaluator): void {
        this.evaluators.set(evaluator.type, evaluator);
    }

    isDue(schedule: AutomationSchedule, now: Date = new Date()): boolean {
        const evaluator = this.evaluators.get(schedule.type);
        if (!evaluator) {
            console.warn(
                `AUTOMATION_SCHEDULER: no schedule evaluator registered for type "${schedule.type}" — treating as never due. Expected until a future part implements cron/interval scheduling.`
            );
            return false;
        }
        return evaluator.isDue(schedule, now);
    }
}

export const schedulerRegistry = new SchedulerRegistry();

/**
 * The one evaluator registered in Part 1. "manual" rules are, by
 * definition, never polled-for-due-ness — they're invoked directly via
 * automationEngine.executeRule(slug). isDue() always returning false for
 * them is correct, not a stub: a manual rule has no timer to be "due" on.
 */
class ManualScheduleEvaluator implements ScheduleEvaluator {
    readonly type: AutomationScheduleType = "manual";

    isDue(): boolean {
        return false;
    }
}

schedulerRegistry.register(new ManualScheduleEvaluator());

/** Convenience passthrough — mirrors audienceResolver.ts's resolveAudience(). */
export function isRuleDue(schedule: AutomationSchedule, now: Date = new Date()): boolean {
    return schedulerRegistry.isDue(schedule, now);
}