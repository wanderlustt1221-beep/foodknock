// src/lib/automation/logger.ts
//
// FoodKnock Automation Engine — execution audit logging (Part 1 + 6 of 6).
//
// The only write path into AutomationExecution — engine.ts calls this
// once per rule run, after the run completes (success or failure). This
// is deliberately AWAITED by the caller, unlike notifications/logger.ts's
// fire-and-forget delivery logging: a live HTTP request must never be
// delayed by notification history logging, but a backend automation run
// has no such constraint, and its own audit trail (did this run get
// recorded at all) is part of what makes the run trustworthy. Still
// wrapped in try/catch so a logging failure can't crash a run that
// otherwise completed successfully.
//
// Part 6: `triggerType`'s param type widened from the narrow
// AutomationTriggerType ("scheduled"|"event"|"manual", a RULE-level
// concept from Part 1) to plain `string`, since engine.ts now threads
// through Part 4's TriggerSource ("manual"|"api"|"scheduled"|"queue"|
// string — already a superset) instead of always hardcoding "manual".
// Any existing caller passing an AutomationTriggerType value still works
// unchanged, since that's a subset of string.

import { connectDB } from "@/lib/db";
import AutomationExecution from "@/models/AutomationExecution";
import type { AutomationExecutionResult } from "./types";

export type LogExecutionParams = {
    ruleId: string;
    triggerType: string;
    result: AutomationExecutionResult;
};

export async function logAutomationExecution(params: LogExecutionParams): Promise<void> {
    const { ruleId, triggerType, result } = params;

    // Defense in depth: engine.ts's own caller never invokes this for dry
    // runs (see engine.ts's finalize()), but guarding here too means a
    // future caller can never accidentally violate "dry runs make zero
    // database mutations" just by forgetting that rule.
    if (result.dryRun) {
        console.warn(
            `AUTOMATION_EXECUTION_LOG: refused to log a dryRun result for rule "${result.ruleSlug}" — dry runs never write to AutomationExecution.`
        );
        return;
    }

    try {
        await connectDB();

        await AutomationExecution.create({
            rule: ruleId,
            ruleSlug: result.ruleSlug,
            triggerType,
            dryRun: false,
            // Part 6 — additive.
            executionId: result.executionId,
            windowKey: result.windowKey,
            preferenceBlockedCount: result.preferenceBlockedCount,
            frequencyBlockedCount: result.frequencyBlockedCount,
            cooldownBlockedCount: result.cooldownBlockedCount,
            deliveryFailedCount: result.deliveryFailedCount,
            usersEvaluated: result.usersEvaluated,
            usersMatched: result.usersMatched,
            usersSkipped: result.usersSkipped,
            notificationsSent: result.notificationsSent,
            notificationsSkipped: result.notificationsSkipped,
            notificationsFailed: result.notificationsFailed,
            status: result.status,
            startedAt: result.startedAt,
            finishedAt: result.finishedAt,
            durationMs: result.durationMs,
            errors: result.errors.slice(0, 20),
            warnings: result.warnings.slice(0, 20),
        });
    } catch (err) {
        console.error("AUTOMATION_EXECUTION_LOG_ERROR", err);
    }
}