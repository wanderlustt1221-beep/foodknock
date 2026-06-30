// src/lib/automation/scheduling/scheduleResolver.ts
//
// FoodKnock Automation Engine — Schedule Resolver (Part 5 of 6).
//
// A registry of real recurrence-pattern evaluators, one per
// AutomationScheduleType — mirrors the EXACT registry pattern already
// used throughout this codebase (audienceResolverRegistry, scheduler.ts's
// own schedulerRegistry, conditionFieldRegistry). "Keep architecture
// open" / "future schedule types" means: a new pattern is one new class
// + one register() call, never a change to windowEvaluator.ts or anything
// that reads this registry.
//
// Every evaluator answers two SEPARATE, composable questions rather than
// one monolithic "is it due":
//   1. matchesRecurrencePattern — does TODAY's date match this schedule's
//      pattern at all (independent of time-of-day)?
//   2. getScheduledSlots — for a date that matches, what time-of-day
//      slot(s) does it fire at?
// windowEvaluator.ts combines both with "has that time arrived yet" to
// decide whether a given (rule, instant) pair represents a due window —
// this file has no opinion on "due", only on "what does this rule's
// schedule pattern actually mean".
//
// This is genuinely pure calendar math — every numeric value (which
// hour, which days of week) comes from the RULE's own config, never
// invented here. No User/Order/Review/Cart field is touched anywhere in
// this file.

import type { AutomationScheduleType } from "../types";
import type { LocalTimeParts } from "./timeResolver";

export type TimeSlot = { hour: number; minute: number };

export interface WindowScheduleResolver {
    readonly type: AutomationScheduleType;
    /** Whether this type fires at specific times of day at all. False only for "immediate" — see its own resolver below. */
    readonly usesTimeSlots: boolean;
    /** Validates `config`'s shape for this type. Empty array = valid. */
    validateConfig(config: Record<string, unknown> | undefined): string[];
    /** Does `local`'s calendar date match this schedule's recurrence pattern, independent of time-of-day? */
    matchesRecurrencePattern(config: Record<string, unknown> | undefined, local: LocalTimeParts): boolean;
    /** The time-of-day slot(s) this schedule fires at on a matching date. Empty for usesTimeSlots:false types. */
    getScheduledSlots(config: Record<string, unknown> | undefined): TimeSlot[];
}

class ScheduleResolverRegistry {
    private resolvers = new Map<AutomationScheduleType, WindowScheduleResolver>();

    register(resolver: WindowScheduleResolver): void {
        this.resolvers.set(resolver.type, resolver);
    }

    get(type: AutomationScheduleType): WindowScheduleResolver | undefined {
        return this.resolvers.get(type);
    }
}

export const scheduleResolverRegistry = new ScheduleResolverRegistry();

// ── Shared validation helpers ──────────────────────────────────────────────

function isValidHour(v: unknown): v is number {
    return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23;
}
function isValidMinute(v: unknown): v is number {
    return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 59;
}
function validateTimeFields(config: Record<string, unknown> | undefined, errors: string[]): void {
    if (!isValidHour(config?.hour)) errors.push("config.hour must be an integer 0-23.");
    if (!isValidMinute(config?.minute)) errors.push("config.minute must be an integer 0-59.");
}

// ── Immediate ────────────────────────────────────────────────────────────
// No fixed time-of-day — matches every check. Pacing for this type comes
// ENTIRELY from the rule's own EXISTING cooldownHours/maxPerDay (Parts
// 1-2, reused, not duplicated) — windowEvaluator.ts treats
// usesTimeSlots:false specially, never assigning it a stable windowKey
// (see that file's header for why a stable key would be meaningless here).
class ImmediateResolver implements WindowScheduleResolver {
    readonly type: AutomationScheduleType = "immediate";
    readonly usesTimeSlots = false;
    validateConfig(): string[] { return []; }
    matchesRecurrencePattern(): boolean { return true; }
    getScheduledSlots(): TimeSlot[] { return []; }
}

// ── Hourly ───────────────────────────────────────────────────────────────
// config: { minute: 0-59 } — fires once every hour, at that minute.
class HourlyResolver implements WindowScheduleResolver {
    readonly type: AutomationScheduleType = "hourly";
    readonly usesTimeSlots = true;
    validateConfig(config: Record<string, unknown> | undefined): string[] {
        const errors: string[] = [];
        if (!isValidMinute(config?.minute)) errors.push("config.minute must be an integer 0-59.");
        return errors;
    }
    matchesRecurrencePattern(): boolean { return true; }
    getScheduledSlots(config: Record<string, unknown> | undefined): TimeSlot[] {
        const minute = config?.minute as number;
        return Array.from({ length: 24 }, (_, hour) => ({ hour, minute }));
    }
}

// ── Daily ────────────────────────────────────────────────────────────────
// config: { hour: 0-23, minute: 0-59 } — fires once a day at that time.
class DailyResolver implements WindowScheduleResolver {
    readonly type: AutomationScheduleType = "daily";
    readonly usesTimeSlots = true;
    validateConfig(config: Record<string, unknown> | undefined): string[] {
        const errors: string[] = [];
        validateTimeFields(config, errors);
        return errors;
    }
    matchesRecurrencePattern(): boolean { return true; }
    getScheduledSlots(config: Record<string, unknown> | undefined): TimeSlot[] {
        return [{ hour: config?.hour as number, minute: config?.minute as number }];
    }
}

// ── Weekly ───────────────────────────────────────────────────────────────
// config: { daysOfWeek: number[] (0=Sun..6=Sat), hour, minute }
class WeeklyResolver implements WindowScheduleResolver {
    readonly type: AutomationScheduleType = "weekly";
    readonly usesTimeSlots = true;
    validateConfig(config: Record<string, unknown> | undefined): string[] {
        const errors: string[] = [];
        const days = config?.daysOfWeek;
        if (!Array.isArray(days) || days.length === 0 || !days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
            errors.push("config.daysOfWeek must be a non-empty array of integers 0-6 (0=Sunday).");
        }
        validateTimeFields(config, errors);
        return errors;
    }
    matchesRecurrencePattern(config: Record<string, unknown> | undefined, local: LocalTimeParts): boolean {
        const days = (config?.daysOfWeek as number[]) ?? [];
        return days.includes(local.weekday);
    }
    getScheduledSlots(config: Record<string, unknown> | undefined): TimeSlot[] {
        return [{ hour: config?.hour as number, minute: config?.minute as number }];
    }
}

// ── Monthly ──────────────────────────────────────────────────────────────
// config: { daysOfMonth: number[] (1-31), hour, minute }
class MonthlyResolver implements WindowScheduleResolver {
    readonly type: AutomationScheduleType = "monthly";
    readonly usesTimeSlots = true;
    validateConfig(config: Record<string, unknown> | undefined): string[] {
        const errors: string[] = [];
        const days = config?.daysOfMonth;
        if (!Array.isArray(days) || days.length === 0 || !days.every((d) => Number.isInteger(d) && d >= 1 && d <= 31)) {
            errors.push("config.daysOfMonth must be a non-empty array of integers 1-31.");
        }
        validateTimeFields(config, errors);
        return errors;
    }
    matchesRecurrencePattern(config: Record<string, unknown> | undefined, local: LocalTimeParts): boolean {
        const days = (config?.daysOfMonth as number[]) ?? [];
        return days.includes(local.day);
        // Note: months with fewer days than a configured value (e.g. 31)
        // simply never match in that month — correct, not a bug; no
        // "last day of month" rollover is invented here.
    }
    getScheduledSlots(config: Record<string, unknown> | undefined): TimeSlot[] {
        return [{ hour: config?.hour as number, minute: config?.minute as number }];
    }
}

// ── Specific Time (one-off, never recurs) ───────────────────────────────
// config: { localDateKey: "YYYY-MM-DD", hour, minute } — expressed
// directly in the RULE's own timezone (AutomationRule.timezone), so this
// resolver never needs to do its own timezone conversion; it only ever
// compares against the already-resolved `local.dateKey`.
class SpecificTimeResolver implements WindowScheduleResolver {
    readonly type: AutomationScheduleType = "specific_time";
    readonly usesTimeSlots = true;
    validateConfig(config: Record<string, unknown> | undefined): string[] {
        const errors: string[] = [];
        if (typeof config?.localDateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(config.localDateKey)) {
            errors.push('config.localDateKey must be a "YYYY-MM-DD" string.');
        }
        validateTimeFields(config, errors);
        return errors;
    }
    matchesRecurrencePattern(config: Record<string, unknown> | undefined, local: LocalTimeParts): boolean {
        return config?.localDateKey === local.dateKey;
    }
    getScheduledSlots(config: Record<string, unknown> | undefined): TimeSlot[] {
        return [{ hour: config?.hour as number, minute: config?.minute as number }];
    }
}

// ── Multiple Times Per Day ───────────────────────────────────────────────
// config: { times: Array<{ hour, minute }> } — e.g. lunch + evening pings.
class MultipleTimesPerDayResolver implements WindowScheduleResolver {
    readonly type: AutomationScheduleType = "multiple_times_per_day";
    readonly usesTimeSlots = true;
    validateConfig(config: Record<string, unknown> | undefined): string[] {
        const errors: string[] = [];
        const times = config?.times;
        if (!Array.isArray(times) || times.length === 0) {
            errors.push("config.times must be a non-empty array of { hour, minute }.");
        } else {
            times.forEach((t, i) => {
                if (!isValidHour(t?.hour)) errors.push(`config.times[${i}].hour must be an integer 0-23.`);
                if (!isValidMinute(t?.minute)) errors.push(`config.times[${i}].minute must be an integer 0-59.`);
            });
        }
        return errors;
    }
    matchesRecurrencePattern(): boolean { return true; }
    getScheduledSlots(config: Record<string, unknown> | undefined): TimeSlot[] {
        return (config?.times as TimeSlot[]) ?? [];
    }
}

// ── Specific Days (fixed month+day, recurring annually — e.g. festivals) ─
// config: { dates: Array<{ month: 1-12, day: 1-31 }>, hour, minute }
class SpecificDaysResolver implements WindowScheduleResolver {
    readonly type: AutomationScheduleType = "specific_days";
    readonly usesTimeSlots = true;
    validateConfig(config: Record<string, unknown> | undefined): string[] {
        const errors: string[] = [];
        const dates = config?.dates;
        if (!Array.isArray(dates) || dates.length === 0) {
            errors.push("config.dates must be a non-empty array of { month, day }.");
        } else {
            dates.forEach((d, i) => {
                if (!Number.isInteger(d?.month) || d.month < 1 || d.month > 12) errors.push(`config.dates[${i}].month must be an integer 1-12.`);
                if (!Number.isInteger(d?.day) || d.day < 1 || d.day > 31) errors.push(`config.dates[${i}].day must be an integer 1-31.`);
            });
        }
        validateTimeFields(config, errors);
        return errors;
    }
    matchesRecurrencePattern(config: Record<string, unknown> | undefined, local: LocalTimeParts): boolean {
        const dates = (config?.dates as Array<{ month: number; day: number }>) ?? [];
        return dates.some((d) => d.month === local.month && d.day === local.day);
    }
    getScheduledSlots(config: Record<string, unknown> | undefined): TimeSlot[] {
        return [{ hour: config?.hour as number, minute: config?.minute as number }];
    }
}

scheduleResolverRegistry.register(new ImmediateResolver());
scheduleResolverRegistry.register(new HourlyResolver());
scheduleResolverRegistry.register(new DailyResolver());
scheduleResolverRegistry.register(new WeeklyResolver());
scheduleResolverRegistry.register(new MonthlyResolver());
scheduleResolverRegistry.register(new SpecificTimeResolver());
scheduleResolverRegistry.register(new MultipleTimesPerDayResolver());
scheduleResolverRegistry.register(new SpecificDaysResolver());