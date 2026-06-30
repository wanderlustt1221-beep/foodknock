// src/models/AutomationExecution.ts
//
// FoodKnock Automation Engine — rule execution audit log (Part 1 of 6).
//
// ── SCOPE: one row per RULE RUN, never per recipient ─────────────────────
// This is the same design principle NotificationLog already applies to
// broadcasts, applied one level up: a rule execution that resolves an
// audience of 10,000 users and sends to 8,000 of them creates ONE
// AutomationExecution row (with aggregate counts), not 8,000. Per-
// recipient delivery outcome already lives in NotificationLog — every
// individual send this engine triggers still flows through
// notificationEngine.send(), which still logs there exactly as before.
// Duplicating that here would be exactly the "duplicate NotificationLog
// responsibilities" the brief explicitly forbids.
//
// What THIS collection answers that NotificationLog cannot: "did rule X
// run today, how big was its audience, how many were filtered out by
// conditions/cooldown/frequency, and did the run itself succeed" — an
// automation-layer audit trail, one level above individual deliveries.

import mongoose, { Schema, model, models } from "mongoose";

const AutomationExecutionSchema = new Schema(
    {
        rule: { type: Schema.Types.ObjectId, ref: "AutomationRule", required: true, index: true },
        // Denormalized so execution history stays readable/queryable even
        // if the rule is later renamed or deleted.
        ruleSlug: { type: String, required: true, index: true },

        triggerType: { type: String, required: true },

        // Part 6: the canonical identifier for this execution attempt
        // (Part 4's ExecutionContext.executionId, threaded through
        // engine.ts). Sparse+unique: every NEW row gets a real,
        // generated value (engine.ts auto-generates one even for direct
        // callers that don't supply it), but the index stays sparse so
        // it imposes no constraint on hypothetical old rows that
        // predate this field. This is what lets
        // automation/api/executionReport.ts retrieve a report for a
        // past execution from a later, separate invocation — required
        // because Vercel Hobby is stateless between invocations.
        executionId: { type: String, default: null },

        // Part 6: the Part 5 scheduling window this run represents, if
        // any — null for manual/retry runs that bypass window-based
        // scheduling entirely.
        windowKey: { type: String, default: null },

        // Always false for any row that actually exists — dry runs never
        // write to this collection at all (see automation/logger.ts's
        // guard and engine.ts's caller). Present in the schema for
        // completeness/forward-compatibility per the brief's explicit
        // field list, not because any current code path sets it true.
        dryRun: { type: Boolean, default: false },

        // ── Funnel counts for this run (Part 3 naming) ────────────────────
        usersEvaluated: { type: Number, default: 0 },        // resolved by AudienceResolver
        usersMatched: { type: Number, default: 0 },           // passed conditions + cooldown + frequency
        usersSkipped: { type: Number, default: 0 },           // FAILED a gate — never became a send candidate
        notificationsSent: { type: Number, default: 0 },      // notificationEngine.send() was called for these
        notificationsSkipped: { type: Number, default: 0 },   // matched, but no notification resulted (no content, or dry run)
        notificationsFailed: { type: Number, default: 0 },    // threw during processing

        // Part 6: granular breakdowns of usersSkipped/notificationsFailed
        // above — additive, see engine.ts's header for exactly which
        // subset of each coarse count these represent. Required by
        // automation/api/executionReport.ts's complete report shape.
        preferenceBlockedCount: { type: Number, default: 0 },
        frequencyBlockedCount: { type: Number, default: 0 },
        cooldownBlockedCount: { type: Number, default: 0 },
        deliveryFailedCount: { type: Number, default: 0 },

        status: {
            type: String,
            enum: ["success", "partial", "failed", "skipped"],
            required: true,
            index: true,
        },

        startedAt: { type: Date, required: true },
        finishedAt: { type: Date, required: true },
        durationMs: { type: Number, default: 0 },

        // Bounded list of error messages encountered during this run —
        // not a full stack trace dump, just enough for support visibility.
        errors: { type: [String], default: [] },
        // Advisory messages that don't represent a failure (e.g. "no
        // content available for this slot for N users") — distinct from
        // errors, which represent something actually going wrong.
        warnings: { type: [String], default: [] },

        metadata: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

// "Show me this rule's recent runs" — the primary admin-history query (future UI).
AutomationExecutionSchema.index({ rule: 1, createdAt: -1 });
AutomationExecutionSchema.index({ ruleSlug: 1, createdAt: -1 });
// "Show me failed/partial runs across all rules" — operational monitoring.
AutomationExecutionSchema.index({ status: 1, createdAt: -1 });
// Part 6: getExecutionReport(executionId)'s primary lookup.
AutomationExecutionSchema.index({ executionId: 1 }, { unique: true, sparse: true });

const AutomationExecution =
    models.AutomationExecution || model("AutomationExecution", AutomationExecutionSchema);

export default AutomationExecution;