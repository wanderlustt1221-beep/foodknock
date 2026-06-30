// src/lib/automation/api/cancel.ts
//
// FoodKnock Automation Engine — Cancel Public API (Part 6 of 6).
//
// "Design architecture for future cancellation. Do NOT implement
// distributed cancellation. Create interfaces. Future-ready only."
//
// Genuinely not implemented: nothing anywhere in the worker pool
// (engine.ts's runWithConcurrency), the batch runner, or the per-user
// processing loop CHECKS for a cancellation signal at any point — adding
// that check would BE the distributed cancellation implementation this
// brief explicitly rules out. This file defines the shape a future part
// would fill in (a CancellationToken interface, a registry of
// in-flight executionIds), and a public cancelExecution() that today
// always returns "not supported" rather than either throwing or
// pretending to cancel something it can't.

export type CancellationStatus = "not_supported" | "requested" | "cancelled" | "not_found";

export type CancellationResult = {
    executionId: string;
    status: CancellationStatus;
    message: string;
};

/**
 * The interface a future cancellation mechanism would implement —
 * intentionally minimal. `requestCancellation` signals intent;
 * `isCancellationRequested` is what a future cooperative check inside
 * the worker pool would poll. No implementation of this interface exists
 * anywhere in this codebase today.
 */
export interface CancellationRegistry {
    requestCancellation(executionId: string): Promise<void>;
    isCancellationRequested(executionId: string): Promise<boolean>;
    clear(executionId: string): Promise<void>;
}

/**
 * Always returns "not_supported" today — see file header for why this
 * is correct, not incomplete. This function exists so future code can
 * call a stable API while the real mechanism is built later, without
 * every caller needing to change.
 */
export async function cancelExecution(executionId: string): Promise<CancellationResult> {
    return {
        executionId,
        status: "not_supported",
        message:
            "Cancellation is architecture-only in this version — no distributed cancellation mechanism is implemented.",
    };
}