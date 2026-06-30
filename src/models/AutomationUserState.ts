// src/models/AutomationUserState.ts
//
// FoodKnock Automation Engine — per-user automation state (Part 1 of 6).
//
// ── ONE DOCUMENT PER USER, NOT PER (USER, RULE) ──────────────────────────
// The brief lists flat fields (lastSent, dailyCount, lastRule, ...) AND a
// `history`. A single field like `lastRule` only makes sense if state can
// span multiple rules for the same user — so this is one document per
// user, with two layers:
//
//   1. Flat top-level fields = a GLOBAL snapshot: the most recent
//      automation activity for this user, across ANY rule, plus global
//      rolling counts (the brief's "future global limits" for
//      FrequencyLimiter — a cross-rule cap needs a cross-rule counter).
//
//   2. `perRule` (a Map keyed by rule slug) = the data cooldown.ts and
//      frequencyLimiter.ts actually gate on: "did THIS rule fire for
//      THIS user recently enough to matter". A Mongoose Map is a real,
//      indexable-by-key field path (`perRule.lunch_reminder.lastSentAt`),
//      not an array that needs scanning — the right structure for
//      100,000+ users where lookups must stay O(1)-ish per rule.
//
// `history` is a small, BOUNDED audit trail (capped in application code,
// not the schema — see automation/engine.ts's recordExecutionForUser) for
// support/debugging visibility. It is never read for gating decisions —
// `perRule` is — so its size has no bearing on correctness, only on how
// far back a human can see what happened.
//
// Window-reset pattern (dailyWindowStart / weeklyWindowStart /
// monthlyWindowStart) mirrors the EXISTING rate-limit pattern already
// used in src/models/User.ts's passwordReset subdocument
// (requestCount + requestWindowStart) — not a new convention.

import mongoose, { Schema, model, models } from "mongoose";

const PerRuleStateSchema = new Schema(
    {
        lastSentAt: { type: Date, default: null },

        hourlyCount: { type: Number, default: 0 },
        hourlyWindowStart: { type: Date, default: null },

        dailyCount: { type: Number, default: 0 },
        dailyWindowStart: { type: Date, default: null },

        weeklyCount: { type: Number, default: 0 },
        weeklyWindowStart: { type: Date, default: null },

        monthlyCount: { type: Number, default: 0 },
        monthlyWindowStart: { type: Date, default: null },

        // Part 2: "Lifetime" frequency dimension — a running total that
        // never resets (no window-start needed, unlike the rolling
        // counters above). Reuses this same sub-schema for perRule AND
        // (below) perCategory/perCampaign, since all three dimensions
        // need the identical shape — one schema, three Map fields.
        lifetimeCount: { type: Number, default: 0 },
    },
    { _id: false }
);

const HistoryEntrySchema = new Schema(
    {
        ruleSlug: { type: String, required: true },
        category: { type: String, default: null },
        sentAt: { type: Date, required: true },
    },
    { _id: false }
);

const AutomationUserStateSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },

        // ── Global snapshot — most recent automation activity, any rule ──
        lastSent: { type: Date, default: null },
        lastCategory: { type: String, default: null },
        lastCampaign: { type: String, default: null },
        lastRule: { type: String, default: null },

        // ── Global rolling counts — across ALL rules ──────────────────────
        hourlyCount: { type: Number, default: 0 },
        hourlyWindowStart: { type: Date, default: null },
        dailyCount: { type: Number, default: 0 },
        dailyWindowStart: { type: Date, default: null },
        weeklyCount: { type: Number, default: 0 },
        weeklyWindowStart: { type: Date, default: null },
        monthlyCount: { type: Number, default: 0 },
        monthlyWindowStart: { type: Date, default: null },
        // Part 2: global "Lifetime" dimension — total automation sends to
        // this user, ever, across every rule. Never resets.
        lifetimeCount: { type: Number, default: 0 },

        // ── Per-rule state — the actual cooldown/frequency gating source ──
        perRule: {
            type: Map,
            of: PerRuleStateSchema,
            default: () => new Map(),
        },

        // Part 2: "Per Category" and "Per Campaign" dimensions — same Map-
        // keyed-by-string structure as perRule, for the same scalability
        // reason (O(1)-ish key lookup, bounded by the number of distinct
        // categories/campaigns ever encountered, not unbounded over time).
        // Keyed by NotificationCategory string and by campaignId
        // respectively. A rule's category-level cooldown/frequency check
        // (cooldown.ts/frequencyLimiter.ts) reads perCategory[rule.category]
        // — "has ANY rule sent this category to this user too recently",
        // independent of which specific rule did the sending.
        perCategory: {
            type: Map,
            of: PerRuleStateSchema,
            default: () => new Map(),
        },
        perCampaign: {
            type: Map,
            of: PerRuleStateSchema,
            default: () => new Map(),
        },

        // ── Bounded audit trail (capped in application code) ──────────────
        history: { type: [HistoryEntrySchema], default: [] },
    },
    { timestamps: true }
);

// One document per user — the only lookup this collection ever needs.
AutomationUserStateSchema.index({ user: 1 }, { unique: true });

const AutomationUserState =
    models.AutomationUserState || model("AutomationUserState", AutomationUserStateSchema);

export default AutomationUserState;