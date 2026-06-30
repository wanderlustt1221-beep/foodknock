// src/lib/automation/scheduling/executionLimiter.ts
//
// FoodKnock Automation Engine — Execution Limiter (Part 5 of 6).
//
// "Prevent same rule executing repeatedly inside same execution window.
// Independent from user cooldown." This is THAT mechanism — distinct
// from Part 1-2's per-USER cooldown/frequency (AutomationUserState,
// unchanged) and distinct from Part 4's in-memory, single-process
// lockManager. This is per-RULE, per-WINDOW, and safe across processes.
//
// The only write path into AutomationWindowClaim, mirroring the "one
// owner per model" discipline every other model in this codebase follows
// (NotificationLog↔notifications/logger.ts, AutomationExecution↔
// automation/logger.ts, AutomationUserState↔engine.ts).
//
// ── HOW THE ATOMIC CLAIM ACTUALLY WORKS ──────────────────────────────────
// claimWindow() attempts AutomationWindowClaim.create({rule, windowKey,
// ...}). The schema's unique compound index on {rule, windowKey} means a
// SECOND concurrent attempt for the same pair fails with MongoDB error
// code 11000 (duplicate key) — caught here and translated into "claim
// failed, someone else already has this window" rather than allowed to
// throw up to the caller. This is correct under genuine concurrency (two
// different serverless invocations racing to insert at the same instant)
// because the uniqueness check happens INSIDE MongoDB's own write path,
// not in any code this file or any caller executes.

import { connectDB } from "@/lib/db";
import AutomationWindowClaim from "@/models/AutomationWindowClaim";

const DUPLICATE_KEY_ERROR_CODE = 11000;

function isDuplicateKeyError(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as { code?: number }).code === DUPLICATE_KEY_ERROR_CODE;
}

export type WindowClaim = {
    claimId: string;
    ruleId: string;
    ruleSlug: string;
    windowKey: string;
};

/**
 * Attempts to atomically claim `windowKey` for `ruleId`. Returns the
 * claim on success, or null if it's already claimed (by this or any
 * other process) — null is the expected, common outcome on a re-check
 * within the same window, not an error condition.
 */
export async function claimWindow(
    ruleId: string,
    ruleSlug: string,
    windowKey: string
): Promise<WindowClaim | null> {
    await connectDB();

    try {
        const doc = await AutomationWindowClaim.create({
            rule: ruleId,
            ruleSlug,
            windowKey,
            claimedAt: new Date(),
            status: "claimed",
        });

        return { claimId: doc._id.toString(), ruleId, ruleSlug, windowKey };
    } catch (err) {
        if (isDuplicateKeyError(err)) {
            return null; // already claimed — not an error, the expected "skip" path
        }
        throw err; // a genuine, unexpected DB error — let the caller decide how to handle it
    }
}

/** Records the outcome of a claimed window's execution — informational, never re-checked for gating (the claim itself, made at claim time, is what already prevented duplicates). */
export async function markWindowOutcome(
    claim: WindowClaim,
    status: "completed" | "failed",
    executionId?: string
): Promise<void> {
    await connectDB();
    try {
        await AutomationWindowClaim.findByIdAndUpdate(claim.claimId, {
            $set: { status, executionId: executionId ?? null },
        });
    } catch (err) {
        // The claim already did its job (preventing a duplicate run) by
        // the time this is called — failing to record the FINAL status is
        // a visibility gap for support/debugging, not a correctness
        // problem, so this is logged rather than thrown.
        console.error("EXECUTION_LIMITER: failed to record window outcome", err);
    }
}

/** Whether `windowKey` has already been claimed for `ruleId` — read-only, for missedExecution.ts's lookback filtering. */
export async function isWindowClaimed(ruleId: string, windowKey: string): Promise<boolean> {
    await connectDB();
    const existing = await AutomationWindowClaim.findOne({ rule: ruleId, windowKey }).select("_id").lean();
    return existing !== null;
}