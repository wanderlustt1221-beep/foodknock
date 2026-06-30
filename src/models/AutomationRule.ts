// src/models/AutomationRule.ts
//
// FoodKnock Automation Engine — rule definitions (Part 1 of 6).
//
// Stores WHAT a rule does and WHEN it's allowed to run — not whether it's
// currently due (that's a future Scheduler's job) and not who it actually
// reached (that's AutomationExecution + NotificationLog's job).
//
// trigger/audience/schedule are stored as { type, config } pairs with
// `type` as a real, indexed field and `config` as Schema.Types.Mixed.
// This is deliberate: the *type* taxonomy is stable and worth indexing
// now (e.g. "find all enabled scheduled rules"), but the *mechanism*
// behind each type (cron string format, segment query shape, etc.) is
// explicitly not built yet — see scheduler.ts and audienceResolver.ts.
// Keeping config as Mixed means those mechanisms can be filled in later
// without a schema migration.
//
// category/priority/channels reuse the exact same enums the Notification
// Engine already validates against — see types.ts's header for why.

import mongoose, { Schema, model, models } from "mongoose";

const TypedConfigSchema = new Schema(
    {
        type: { type: String, required: true, index: true },
        config: { type: Schema.Types.Mixed, default: {} },
    },
    { _id: false }
);

const ConditionSchema = new Schema(
    {
        field: { type: String, required: true },
        operator: {
            type: String,
            required: true,
            enum: ["eq", "neq", "gt", "gte", "lt", "lte", "in", "nin", "exists"],
        },
        value: { type: Schema.Types.Mixed },
    },
    { _id: false }
);

const AutomationRuleSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },

        // Stable, human-readable identifier — used for lookups, logging,
        // and as the AutomationUserState.perRule Map key. Distinct from
        // Mongo's _id so logs/state remain readable without a join.
        slug: { type: String, required: true, unique: true, trim: true, lowercase: true },

        enabled: { type: Boolean, default: false, index: true },

        trigger: { type: TypedConfigSchema, required: true },
        audience: { type: TypedConfigSchema, required: true },
        schedule: { type: TypedConfigSchema, required: true },

        conditions: { type: [ConditionSchema], default: [] },

        // Reuses the Notification Engine's own vocabulary — see types.ts.
        category: { type: String, required: true },
        priority: { type: String, required: true, default: "normal" },
        channels: { type: [String], required: true, default: ["push"] },

        // Which marketing content pool (MarketingSlot) this rule pulls
        // from via the existing rotation system — see automation/rotation.ts.
        libraryCategory: { type: String, required: true },

        maxPerHour: { type: Number, default: null, min: 0 },
        maxPerDay: { type: Number, default: 1, min: 0 },
        cooldownHours: { type: Number, default: 24, min: 0 },

        // ── Part 2: optional multi-dimensional cooldown/frequency ─────────
        // All default to null/unset — a rule that doesn't set these
        // behaves EXACTLY as it did in Part 1 (only rule-level + global
        // gating applies). A rule opts INTO category/campaign-level
        // gating by setting these explicitly. "Lifetime" limits (maxLifetime)
        // are similarly optional and unenforced unless set.
        categoryCooldownHours: { type: Number, default: null, min: 0 },
        campaignCooldownHours: { type: Number, default: null, min: 0 },
        categoryMaxPerDay: { type: Number, default: null, min: 0 },
        campaignMaxPerDay: { type: Number, default: null, min: 0 },
        maxLifetime: { type: Number, default: null, min: 0 },

        // Activation window — when this rule is even allowed to fire,
        // independent of whether a scheduler has decided it's "due".
        activeFrom: { type: Date, default: null },
        activeUntil: { type: Date, default: null },
        timezone: { type: String, default: "Asia/Kolkata" },

        // Free-form, future-proofing bucket — anything not yet promoted
        // to a real field lives here without requiring a migration.
        metadata: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

// Lookup by slug (executeRule's primary entry point).
AutomationRuleSchema.index({ slug: 1 }, { unique: true });
// "Find all enabled rules" — the eventual scheduler's main query.
AutomationRuleSchema.index({ enabled: 1 });
// "Find all enabled rules of a given trigger type" (e.g. all scheduled ones).
AutomationRuleSchema.index({ "trigger.type": 1, enabled: 1 });

const AutomationRule = models.AutomationRule || model("AutomationRule", AutomationRuleSchema);

export default AutomationRule;