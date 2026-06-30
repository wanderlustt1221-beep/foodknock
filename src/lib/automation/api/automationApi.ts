// src/lib/automation/api/automationApi.ts
//
// FoodKnock Automation Engine — Core Public API (Part 6 of 6).
//
// runDueAutomations() and runRule() are thin translations over what
// already fully exists and works: Part 5's runnerApi.runDueAutomations()
// (scheduling → window evaluation → window claim → Runner) and Part 4's
// runner.runOne() (Runner → Automation Engine). Neither function below
// contains any new orchestration logic — they call the existing chain
// and map its result through executionReport.ts's one translation
// function. This IS "Connect every architecture layer into one official
// execution flow" — the connecting was already done across Parts 1-5;
// this is the official, single entry point for using it.

import { runDueAutomations as runDueAutomationsInternal } from "../scheduling";
import { runner } from "../runner";
import { buildExecutionReport } from "./executionReport";
import type { ExecutionReport } from "./executionReport";

/**
 * The official entry point for "run whatever's due right now" — what an
 * external trigger (whatever invokes this part's API; no cron/scheduler
 * is created here, per the brief) should call. Delegates entirely to
 * Part 5's scheduling layer (External Trigger → Scheduling → Window
 * Evaluation → Window Claim → Runner) and Part 4's Runner (→ Automation
 * Engine) — see that module's own header for the full chain.
 */
export async function runDueAutomations(): Promise<ExecutionReport[]> {
    const { results } = await runDueAutomationsInternal();
    return results
        .filter((r) => r.automationResult !== null)
        .map((r) => buildExecutionReport(r.automationResult!));
}

/**
 * Runs exactly one rule by slug, right now, bypassing schedule/window
 * discovery entirely — the explicit single-rule entry point. Delegates
 * to Part 4's runner.runOne() (Runner → Automation Engine), unchanged.
 */
export async function runRule(ruleSlug: string, initiatedBy?: string): Promise<ExecutionReport> {
    const result = await runner.runOne({ ruleSlug, initiatedBy });
    if (!result.automationResult) {
        // Lock contention, rule-not-found, or rule-invalid — the Runner
        // layer's own result already distinguishes which; surface it as
        // a failed report rather than throwing, consistent with every
        // existing execution function's "never throw" contract.
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
            errors: [result.runnerError ?? "Execution did not reach the Automation Engine."],
            warnings: [],
            dryRun: false,
        };
    }
    return buildExecutionReport(result.automationResult);
}