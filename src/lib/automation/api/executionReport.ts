// src/lib/automation/api/executionReport.ts
//
// FoodKnock Automation Engine — Execution Report (Part 6 of 6).
//
// The unified report shape every public function in automation/api/
// returns. One mapping function (buildExecutionReport) is the ONLY place
// AutomationExecutionResult's internal field names get translated into
// the brief's report vocabulary (usersMatched→usersEligible,
// durationMs→duration, ruleSlug→rule, etc.) — every other file in this
// folder calls it rather than building a report by hand, satisfying
// "verify no duplicated logic exists" for this specific translation.
//
// getExecutionReport() is the one function here that reads PERSISTED
// data rather than translating an in-memory result — necessary because
// Vercel Hobby is stateless: a report requested in a LATER, separate
// invocation than the one that ran the execution has nothing in memory
// to read from. AutomationExecution.executionId (Part 6's addition to
// that model) is what makes this lookup possible at all.

import { connectDB } from "@/lib/db";
import AutomationExecution from "@/models/AutomationExecution";
import type { AutomationExecutionResult, AutomationExecutionStatus } from "../types";

export type ExecutionReport = {
    executionId: string;
    rule: string;
    status: AutomationExecutionStatus;
    startedAt: Date;
    finishedAt: Date;
    duration: number;
    triggerSource: string;
    window: string | null;
    usersEvaluated: number;
    usersEligible: number;
    notificationsSent: number;
    notificationsSkipped: number;
    preferenceBlocked: number;
    frequencyBlocked: number;
    cooldownBlocked: number;
    deliveryFailed: number;
    errors: string[];
    warnings: string[];
    dryRun: boolean;
};

/**
 * The one translation from AutomationExecutionResult (Parts 1-3/6's
 * internal vocabulary) into the brief's official report vocabulary.
 * Every public function in this folder funnels its result through this
 * — automationApi.ts, dryRun.ts, retry.ts all call this rather than
 * building a report object themselves.
 */
export function buildExecutionReport(result: AutomationExecutionResult): ExecutionReport {
    return {
        executionId: result.executionId,
        rule: result.ruleSlug,
        status: result.status,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        duration: result.durationMs,
        triggerSource: result.triggerSource,
        window: result.windowKey,
        usersEvaluated: result.usersEvaluated,
        usersEligible: result.usersMatched,
        notificationsSent: result.notificationsSent,
        notificationsSkipped: result.notificationsSkipped,
        preferenceBlocked: result.preferenceBlockedCount,
        frequencyBlocked: result.frequencyBlockedCount,
        cooldownBlocked: result.cooldownBlockedCount,
        deliveryFailed: result.deliveryFailedCount,
        errors: result.errors,
        warnings: result.warnings,
        dryRun: result.dryRun,
    };
}

type PersistedExecutionDoc = {
    executionId: string;
    ruleSlug: string;
    status: AutomationExecutionStatus;
    startedAt: Date;
    finishedAt: Date;
    durationMs: number;
    triggerType: string;
    windowKey: string | null;
    usersEvaluated: number;
    usersMatched: number;
    notificationsSent: number;
    notificationsSkipped: number;
    preferenceBlockedCount: number;
    frequencyBlockedCount: number;
    cooldownBlockedCount: number;
    deliveryFailedCount: number;
    errors: string[];
    warnings: string[];
    dryRun: boolean;
};

function buildExecutionReportFromPersisted(doc: PersistedExecutionDoc): ExecutionReport {
    return {
        executionId: doc.executionId,
        rule: doc.ruleSlug,
        status: doc.status,
        startedAt: doc.startedAt,
        finishedAt: doc.finishedAt,
        duration: doc.durationMs,
        triggerSource: doc.triggerType,
        window: doc.windowKey,
        usersEvaluated: doc.usersEvaluated,
        usersEligible: doc.usersMatched,
        notificationsSent: doc.notificationsSent,
        notificationsSkipped: doc.notificationsSkipped,
        preferenceBlocked: doc.preferenceBlockedCount,
        frequencyBlocked: doc.frequencyBlockedCount,
        cooldownBlocked: doc.cooldownBlockedCount,
        deliveryFailed: doc.deliveryFailedCount,
        errors: doc.errors,
        warnings: doc.warnings,
        dryRun: doc.dryRun,
    };
}

/**
 * Retrieves a report for a PAST execution, by its executionId, from
 * PERSISTED data — this is the only one of automation/api/'s six public
 * functions that doesn't itself trigger any execution. Returns null if
 * not found, which is the EXPECTED outcome for a dry run's executionId
 * (dry runs never write to AutomationExecution at all, by design — see
 * engine.ts's finalize() and automation/logger.ts's own guard) — not an
 * error, just an honest "there's nothing to retrieve for that id".
 */
export async function getExecutionReport(executionId: string): Promise<ExecutionReport | null> {
    await connectDB();
    const doc = (await AutomationExecution.findOne({ executionId }).lean()) as unknown as PersistedExecutionDoc | null;
    return doc ? buildExecutionReportFromPersisted(doc) : null;
}