// src/lib/automation/api/dryRun.ts
//
// FoodKnock Automation Engine — Dry Run Public API (Part 6 of 6).
//
// "Dry Run must execute the complete pipeline except: NO Notification
// Engine send, NO Provider, NO Database writes, NO Execution log, NO
// Notification log. Everything else should execute exactly the same."
// This is EXACTLY what engine.ts's processUser() already does (Parts
// 1-3, verified there: dryRun's terminal branch returns before
// notificationEngine.send() is ever called, and finalize() skips
// logAutomationExecution() entirely for dryRun results) — this file adds
// NOTHING new, it's a one-line translation of that existing result into
// the unified report shape.

import { runner } from "../runner";
import { buildExecutionReport } from "./executionReport";
import type { ExecutionReport } from "./executionReport";

export async function dryRun(ruleSlug: string, initiatedBy?: string): Promise<ExecutionReport> {
    const result = await runner.runOne({ ruleSlug, initiatedBy, dryRun: true });

    if (!result.automationResult) {
        return {
            executionId: result.context.executionId,
            rule: ruleSlug,
            status: "failed",
            startedAt: result.context.startedAt,
            finishedAt: result.finishedAt,
            duration: result.durationMs,
            triggerSource: result.context.triggerSource,
            window: null,
            usersEvaluated: 0,
            usersEligible: 0,
            notificationsSent: 0,
            notificationsSkipped: 0,
            preferenceBlocked: 0,
            frequencyBlocked: 0,
            cooldownBlocked: 0,
            deliveryFailed: 0,
            errors: [result.runnerError ?? "Dry run did not reach the Automation Engine."],
            warnings: [],
            dryRun: true,
        };
    }

    return buildExecutionReport(result.automationResult);
}