// src/lib/notifications/marketing/rotation.ts
//
// FoodKnock Notification Engine — Smart Random Rotation.
//
// "Future scheduler should simply ask 'give one Lunch notification' and
// the engine should automatically choose one." That's exactly the two
// functions below: pickMarketingNotification() does the choosing,
// buildMarketingPayload() turns the choice into a ready-to-send
// NotificationPayload. A future scheduler's entire integration is:
//
//   const template = await pickMarketingNotification("lunch", userId);
//   if (template) {
//       await notificationEngine.send(["push"], { userId }, buildMarketingPayload(template));
//   }
//
// No scheduler is implemented here — per the brief, that's deliberately
// out of scope for this phase. This is the architecture it will plug into.
//
// ── HOW ROTATION TRACKING WORKS — no new collection ─────────────────────
// Recently-shown tracking reuses NotificationLog's existing `meta` field
// (already a free-form Mixed bag for event-specific context — see
// NotificationLog.ts) rather than introducing a dedicated "rotation
// history" table. Every marketing send's payload carries
// `data: { marketingId, marketingSlot }`, which the logger already copies
// verbatim into `meta` (logger.ts's existing behavior, unchanged). This
// function reads that back via `meta.marketingSlot` / `meta.marketingId`.
// Reusing NotificationLog this way means rotation has zero storage
// overhead beyond what's already being written for history/analytics.

import { connectDB } from "@/lib/db";
import NotificationLog from "@/models/NotificationLog";
import { MARKETING_LIBRARY } from "./library";
import type { MarketingNotificationTemplate, MarketingSlot } from "./types";
import type { NotificationPayload } from "../types";

/** How many of a user's most recent sends in this slot to treat as "recently shown". */
const ROTATION_LOOKBACK = 5;

type RecentMetaDoc = { meta?: { marketingId?: unknown } };

/**
 * Picks one template from `slot`, avoiding whatever this user was shown
 * most recently in that same slot. Falls back to the full pool (never
 * returns null when the slot has templates) if every template has been
 * shown within the lookback window — "no immediate repeat" is best-effort
 * once a slot's pool is smaller than the lookback, not a hard guarantee.
 *
 * `userId` is optional: with no user (a broadcast context), there's no
 * per-recipient history to check against, so this just picks randomly
 * from the full pool — the same reasoning NotificationLog already applies
 * to broadcasts generally (no per-recipient state is tracked for them).
 */
export async function pickMarketingNotification(
    slot: MarketingSlot,
    userId?: string | null
): Promise<MarketingNotificationTemplate | null> {
    const pool = MARKETING_LIBRARY.filter((t) => t.slot === slot);
    if (pool.length === 0) return null;
    if (pool.length === 1 || !userId) {
        return pool[Math.floor(Math.random() * pool.length)];
    }

    await connectDB();

    const recent = (await NotificationLog.find({ user: userId, "meta.marketingSlot": slot })
        .sort({ createdAt: -1 })
        .limit(ROTATION_LOOKBACK)
        .select("meta")
        .lean()) as unknown as RecentMetaDoc[];

    const recentlyUsedIds = new Set(
        recent
            .map((r) => r.meta?.marketingId)
            .filter((id): id is string => typeof id === "string")
    );

    const fresh = pool.filter((t) => !recentlyUsedIds.has(t.id));
    const candidates = fresh.length > 0 ? fresh : pool;

    return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Converts a chosen template into a ready-to-send NotificationPayload.
 * Sets `data.marketingId`/`data.marketingSlot` — the exact fields
 * pickMarketingNotification() reads back next time — so calling this and
 * sending the result through the engine is the ONLY step needed to keep
 * rotation tracking correct; no caller does any bookkeeping itself.
 */
export function buildMarketingPayload(template: MarketingNotificationTemplate): NotificationPayload {
    return {
        title: template.title,
        body: template.body,
        url: template.url,
        category: template.category,
        priority: template.priority,
        imageUrl: template.imageUrl,
        tag: template.tag,
        ctaButtons: [{ id: template.id, label: template.ctaLabel, url: template.url }],
        data: {
            kind: `marketing.${template.slot}`,
            marketingId: template.id,
            marketingSlot: template.slot,
        },
    };
}