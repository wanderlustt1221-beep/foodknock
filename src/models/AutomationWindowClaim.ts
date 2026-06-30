// src/models/AutomationWindowClaim.ts
//
// FoodKnock Automation Engine — Window Claim (Part 5 of 6).
//
// ── WHY THIS MODEL EXISTS, GENUINELY NEW, NOT A DUPLICATE OF ANYTHING ────
// Part 4's lockManager.ts is explicitly in-memory — by its own design, it
// only prevents concurrent execution WITHIN ONE PROCESS. This brief
// explicitly asks for duplicate protection "designed for distributed
// systems" — multiple possible external cron sources (Vercel Cron,
// GitHub Actions, EasyCron, cron-job.org, Railway Cron), each potentially
// invoking a separate serverless instance with no shared memory. An
// in-memory lock cannot solve that; nothing in Parts 1-4 was built to.
//
// AutomationExecution (Parts 1-3) is NOT a substitute for this: it's
// written ONCE, AFTER a run completes, purely as an aggregate audit log
// — there is no atomic "claim before you start" operation anywhere in
// its write path, and adding one would mean touching already-verified
// Part 1-3 code for a concern that was never its job. This collection's
// only responsibility is the one new thing actually needed: "has rule R
// already claimed window W" — answered by a UNIQUE COMPOUND INDEX that
// MongoDB itself enforces atomically. A second concurrent attempt to
// insert the same (rule, windowKey) pair fails with a duplicate-key
// error (E11000) at the DATABASE level — this is correct across any
// number of concurrent serverless invocations, by construction, not by
// careful in-process coordination.
//
// One row per (rule, windowKey) — never per recipient, same "aggregate
// only" discipline every other automation/notification model in this
// codebase follows.

import mongoose, { Schema, model, models } from "mongoose";

const AutomationWindowClaimSchema = new Schema(
    {
        rule: { type: Schema.Types.ObjectId, ref: "AutomationRule", required: true },
        // Denormalized for readability without a join — same pattern
        // AutomationExecution already uses for its own ruleSlug field.
        ruleSlug: { type: String, required: true },

        // "{localDateKey}#{HH:mm}" — see scheduling/windowEvaluator.ts for
        // exactly how this is constructed. Opaque to this model; it only
        // needs to be a stable, comparable string.
        windowKey: { type: String, required: true },

        claimedAt: { type: Date, required: true },

        // Updated after the Runner's result comes back — lets a future
        // missed-execution check distinguish "claimed and finished" from
        // "claimed but never updated" (e.g. the process crashed between
        // claiming and recording the outcome) without needing to query
        // AutomationExecution at all.
        status: {
            type: String,
            enum: ["claimed", "completed", "failed"],
            default: "claimed",
            required: true,
        },

        // Links back to the Runner's own executionId (Part 4's
        // ExecutionContext) once known — purely for cross-referencing
        // during support/debugging, never queried directly.
        executionId: { type: String, default: null },
    },
    { timestamps: true }
);

// The actual duplicate-protection mechanism: MongoDB enforces this
// atomically across any number of concurrent inserts, on any number of
// separate processes/serverless instances. This is the line that makes
// "design this for distributed systems" true, not just documented.
AutomationWindowClaimSchema.index({ rule: 1, windowKey: 1 }, { unique: true });

// "Show me this rule's recent windows" — for missed-execution lookback
// queries (scheduling/missedExecution.ts) and future support visibility.
AutomationWindowClaimSchema.index({ ruleSlug: 1, claimedAt: -1 });

const AutomationWindowClaim =
    models.AutomationWindowClaim || model("AutomationWindowClaim", AutomationWindowClaimSchema);

export default AutomationWindowClaim;