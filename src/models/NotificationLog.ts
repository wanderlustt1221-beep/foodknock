// src/models/NotificationLog.ts
//
// FoodKnock Notification Engine — delivery history & analytics foundation.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────
// Until now, the Notification Engine fired and forgot: a send() call
// produced a DeliveryResult, the caller used it for an HTTP response, and
// then it was gone. There was no record a notification ever happened —
// which means no inbox, no admin history, no analytics were possible.
// This model is that missing record, written automatically by the engine
// (see src/lib/notifications/logger.ts + the hook in engine.ts) for every
// channel attempt, with zero changes required to any business code.
//
// ── SCHEMA DESIGN DECISION: one row per SEND, not per RECIPIENT ─────────
// A broadcast to 10,000 push subscribers does NOT create 10,000 documents
// here. It creates ONE document with aggregate sentCount/failedCount —
// exactly like a campaign-analytics row in any real ESP/push platform.
// Transactional events (order.placed, order.delivered, etc.) are already
// single-recipient by construction (the engine's safety rail in engine.ts
// requires target.userId for them), so for those, "one row per send" is
// already "one row per recipient" — no special-casing needed.
//
// Practical consequence: querying `{ user: userId }` for an inbox returns
// only that user's personal transactional notifications, not a duplicated
// copy of every broadcast that happened to reach them. This matches how
// Swiggy/Zomato-style inboxes actually behave (order updates, not promo
// spam re-listed per user). If a future requirement needs broadcasts to
// also appear in personal inboxes, that's an additive fan-out job (e.g. a
// background worker writing a lightweight NotificationRecipient join row
// per subscriber) layered on top of this collection — not a redesign of it.
//
// ── FIELDS RESERVED FOR FUTURE FEATURES (intentionally unused today) ────
// openedAt, clickedAt — included now so the click/open-tracking analytics
// feature (separate, later step) is additive to this schema rather than
// requiring a migration when it lands. imageUrl and the other rich-payload
// fields below were reserved here in Feature 1/2 and are now populated by
// Feature 3 — see that section for details.

import mongoose, { Schema, model, models } from "mongoose";

const NotificationLogSchema = new Schema(
    {
        // Which business event produced this send, e.g. "order.delivered",
        // "push.campaign", "admin.broadcast". Loosely typed as String (not
        // a Mongoose enum) because the engine derives this from
        // payload.data.kind at write-time and falls back to "unknown" for
        // direct-send callers that don't set it (see logger.ts) — an enum
        // would reject that intentional fallback.
        event: {
            type: String,
            required: true,
            index: true,
        },

        channel: {
            type: String,
            required: true,
            enum: ["push", "email", "whatsapp", "sms"],
            index: true,
        },

        // ── Targeting recap ──────────────────────────────────────────────
        // Exactly the same shape as NotificationTarget in types.ts, denormalized
        // so history/inbox queries never need to join back to a live target.
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
        isBroadcast: {
            type: Boolean,
            default: false,
            index: true,
        },

        // ── Content snapshot ─────────────────────────────────────────────
        // Denormalized (not a reference back to a template) so history
        // remains accurate forever even if marketing copy pools change
        // later — this row shows exactly what was actually sent.
        title: { type: String, required: true },
        body: { type: String, required: true },
        url: { type: String, default: "" },
        // Reserved for the Rich Notifications feature (large hero image).
        // Always "" until that feature wires a real value through
        // NotificationPayload — see file header.
        imageUrl: { type: String, default: "" },

        // ── Rich payload snapshot (Feature 3) ────────────────────────────
        // Same denormalization rationale as title/body/url above: a row
        // shows exactly what was sent, even if branding defaults or a
        // marketing template's copy change later. Defaults here only
        // protect NEW writes — rows created before this feature existed
        // simply lack these paths entirely; every reader (inboxQuery.ts,
        // logger.ts) applies its own `??` fallback at read time rather
        // than relying on Mongoose schema defaults to retroactively backfill
        // documents that already exist.
        priority: { type: String, enum: ["low", "normal", "high", "urgent"], default: "normal" },
        category: { type: String, default: "general", index: true },
        accentColor: { type: String, default: "#FF5C1A" },
        badgeText: { type: String, default: "" },
        tag: { type: String, default: "" },
        campaignId: { type: String, default: null, index: true },
        expiresAt: { type: Date, default: null },
        ctaButtons: {
            type: [{ id: String, label: String, url: String }],
            default: [],
        },

        // ── Delivery outcome (aggregate across all recipients of this send) ─
        sentCount: { type: Number, default: 0 },
        failedCount: { type: Number, default: 0 },
        deactivatedCount: { type: Number, default: 0 },

        // Derived status for quick filtering in history/analytics UIs
        // without recomputing from the three counts above every time.
        // "skipped" covers a real, distinct case: a provider explicitly
        // declined to send (e.g. EmailDeliveryProvider's not-yet-implemented
        // events) — this looks identical to a zero-recipient broadcast at
        // the raw count level, so it's classified conservatively as
        // "skipped" rather than falsely as "sent". See logger.ts.
        status: {
            type: String,
            enum: ["sent", "failed", "partial", "skipped"],
            required: true,
            index: true,
        },

        // ── Engagement analytics (reserved) ──────────────────────────────
        // Populated later by open/click-tracking endpoints — not built in
        // this phase. Reserved now so that feature is additive, not a
        // migration. null = not yet tracked / not applicable to this channel.
        openedAt: { type: Date, default: null },
        clickedAt: { type: Date, default: null },

        // ── Read state (User Notification Inbox) ─────────────────────────
        // Added for the Inbox feature. null = unread (the default for every
        // row ever written, including all rows created before this field
        // existed — Mongoose treats a missing path as undefined, which
        // every read/unread check below treats identically to null). Only
        // set once, on first read — see PATCH /api/notifications/[id]/read.
        readAt: { type: Date, default: null },

        // Free-form event-specific context (orderId, otp flow, slot, admin
        // test-send subscriptionIds, etc.) — never queried directly, purely
        // for support/debugging visibility in a future history detail view.
        meta: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

// Inbox query: "this user's notifications, newest first"
NotificationLogSchema.index({ user: 1, createdAt: -1 });
// Admin history query: "broadcasts/campaigns, newest first"
NotificationLogSchema.index({ isBroadcast: 1, createdAt: -1 });
// Analytics query: "all sends of this event type over time" (e.g. CTR per event)
NotificationLogSchema.index({ event: 1, createdAt: -1 });
// Unread-count query: "how many of this user's notifications are unread"
NotificationLogSchema.index({ user: 1, readAt: 1 });

const NotificationLog =
    models.NotificationLog || model("NotificationLog", NotificationLogSchema);

export default NotificationLog;