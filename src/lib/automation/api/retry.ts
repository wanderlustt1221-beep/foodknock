// src/lib/automation/api/retry.ts
//
// FoodKnock Automation Engine — Retry Public API (Part 6 of 6).
//
// "Retry must NEVER resend to successful users. Retry ONLY: delivery
// failures, temporary provider failures, timeout failures... Reuse
// existing execution history. Do NOT invent duplicate tracking."
//
// The mechanism, end to end:
//   1. Look up the past execution (AutomationExecution, by executionId —
//      Part 6's addition to that model).
//   2. Find which SPECIFIC users had a genuine delivery failure for that
//      execution, by querying NotificationLog (Feature 1, untouched) —
//      see helpers.ts for exactly how, reusing its existing indexed
//      campaignId/createdAt fields rather than inventing a new tracking
//      model.
//   3. Re-run the SAME rule with audienceOverride set to EXACTLY those
//      user IDs (engine.ts's Part 6 addition) — every gate (conditions,
//      cooldown, frequency, content selection) still applies normally to
//      each of them; this isn't a bypass of those checks, only a
//      narrower candidate pool. A user whose cooldown has since reactivated
//      for some unrelated reason is correctly skipped again, not blindly
//      resent.
//
// Users who were "skipped" (condition/cooldown/frequency/preference) are
// NEVER included here — those are correct, deliberate decisions, not
// failures, and retrying them would be retrying something that was never
// broken. Only NotificationLog rows with status "failed" or "partial"
// (a genuine delivery/provider-level problem) are retried.

import { connectDB } from "@/lib/db";
import AutomationExecution from "@/models/AutomationExecution";
import { automationEngine } from "../engine";
import { findFailedUserIdsForExecution } from "./helpers";
import { buildExecutionReport } from "./executionReport";
import type { ExecutionReport } from "./executionReport";

type PastExecutionDoc = {
    executionId: string;
    ruleSlug: string;
    startedAt: Date;
    finishedAt: Date;
    dryRun: boolean;
};

function emptyReport(executionId: string, ruleSlug: string, errors: string[], warnings: string[] = []): ExecutionReport {
    const now = new Date();
    return {
        executionId,
        rule: ruleSlug,
        status: errors.length > 0 ? "failed" : "skipped",
        startedAt: now,
        finishedAt: now,
        duration: 0,
        triggerSource: "retry",
        window: null,
        usersEvaluated: 0,
        usersEligible: 0,
        notificationsSent: 0,
        notificationsSkipped: 0,
        preferenceBlocked: 0,
        frequencyBlocked: 0,
        cooldownBlocked: 0,
        deliveryFailed: 0,
        errors,
        warnings,
        dryRun: false,
    };
}

/**
 * Retries only the genuinely-failed users from a past execution,
 * identified by its executionId. Never throws — every failure path
 * (execution not found, no failures to retry, the rule itself failing
 * again) resolves to a report, the same "always resolves" contract every
 * other public function in this folder follows.
 */
export async function retryExecution(executionId: string): Promise<ExecutionReport> {
    await connectDB();

    const original = (await AutomationExecution.findOne({ executionId }).lean()) as unknown as PastExecutionDoc | null;

    if (!original) {
        return emptyReport(executionId, "unknown", [
            `No execution found for executionId "${executionId}" — it may have been a dry run (never persisted) or the id is invalid.`,
        ]);
    }

    const failedUserIds = await findFailedUserIdsForExecution(original.ruleSlug, original.startedAt, original.finishedAt);

    if (failedUserIds.length === 0) {
        return emptyReport(executionId, original.ruleSlug, [], [
            "No delivery failures found for this execution — nothing to retry.",
        ]);
    }

    const retryExecutionId = crypto.randomUUID();
    const result = await automationEngine.executeRule(original.ruleSlug, {
        audienceOverride: failedUserIds,
        executionId: retryExecutionId,
        triggerSource: "retry",
    });

    const report = buildExecutionReport(result);
    report.warnings = [...report.warnings, `Retry of execution "${executionId}" — targeted ${failedUserIds.length} previously-failed user(s).`];
    return report;
}