// src/lib/notifications/logger.ts
//
// FoodKnock Notification Engine — delivery history writer.
//
// Called from engine.ts's send() after every provider.send() resolves.
// This is the ONLY write path into NotificationLog — business code, routes,
// and providers never write to it directly, the same way they never call
// a provider directly. Keeping this in its own file (rather than inline in
// engine.ts) mirrors the existing separation of concerns: engine.ts
// orchestrates, providers deliver, templates render, this module persists.

import { connectDB } from "@/lib/db";
import NotificationLog from "@/models/NotificationLog";
import type {
    DeliveryResult,
    NotificationChannel,
    NotificationPayload,
    NotificationTarget,
} from "./types";

/**
 * Derives a human-meaningful event label for history/analytics.
 *
 * Event-driven sends (anything that went through emit() → handleEvent())
 * always have `payload.data.kind` set by their template — see
 * transactionalTemplates.ts / templates.ts, an established Phase 4
 * convention. Direct-send callers (cron campaign route, admin broadcast
 * route) currently don't set it, so they fall back to "unknown" — a known,
 * accepted precision gap rather than a bug. Sharpening it later is a
 * one-line additive change at each call site (adding `data: { kind: "..." }`
 * to their existing payload), not a change to this function.
 */
function deriveEventLabel(payload: NotificationPayload): string {
    const kind = (payload.data as { kind?: unknown } | undefined)?.kind;
    return typeof kind === "string" && kind.length > 0 ? kind : "unknown";
}

/**
 * Classifies a DeliveryResult into a single status for filtering.
 *
 * "skipped" exists because a zero/zero result is genuinely ambiguous at
 * the DeliveryResult level: it's produced both by a real broadcast that
 * happened to reach zero active subscribers AND by a provider explicitly
 * declining to send (e.g. EmailDeliveryProvider's not-yet-implemented
 * event cases). Classifying that as "sent" would make history lie about
 * notifications that never went out, so it's classified as "skipped"
 * instead — the more honest of the two imperfect options.
 */
function deriveStatus(result: DeliveryResult): "sent" | "failed" | "partial" | "skipped" {
    if (result.sent > 0 && result.failed === 0) return "sent";
    if (result.sent === 0 && result.failed > 0) return "failed";
    if (result.sent > 0 && result.failed > 0) return "partial";
    return "skipped";
}

export type LogDeliveryParams = {
    channel: NotificationChannel;
    target: NotificationTarget;
    payload: NotificationPayload;
    result: DeliveryResult;
};

/**
 * Writes one history row for one channel-attempt of one send. Always
 * called fire-and-forget by engine.ts — never awaited in a way that could
 * delay or fail a caller's response, and never allowed to throw into it.
 * Error isolation is enforced here AND at the call site for defense in depth.
 */
export async function logNotificationDelivery(params: LogDeliveryParams): Promise<void> {
    const { channel, target, payload, result } = params;

    try {
        await connectDB();

        const meta: Record<string, unknown> = { ...(payload.data ?? {}) };
        if (target.subscriptionIds?.length) {
            // Admin "send test" targets a specific subscription, not a user
            // or a broadcast — preserved here purely for support visibility
            // in a future history detail view.
            meta.subscriptionIds = target.subscriptionIds;
        }

        await NotificationLog.create({
            event: deriveEventLabel(payload),
            channel,
            user: target.userId ?? null,
            isBroadcast: !!target.broadcast,
            title: payload.title,
            body: payload.body,
            url: payload.url ?? "",
            imageUrl: payload.imageUrl ?? "",
            // priority/category are always set by the time a payload reaches
            // here — engine.ts's send() runs applyBranding() before calling
            // this — but `?? ` fallbacks are kept anyway as defense in depth
            // against any future direct caller of logNotificationDelivery
            // that bypasses that step.
            priority: payload.priority ?? "normal",
            category: payload.category ?? "general",
            accentColor: payload.accentColor ?? "#FF5C1A",
            badgeText: payload.badgeText ?? "",
            tag: payload.tag ?? "",
            campaignId: payload.campaignId ?? null,
            expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
            ctaButtons: payload.ctaButtons ?? [],
            sentCount: result.sent,
            failedCount: result.failed,
            deactivatedCount: result.deactivated,
            status: deriveStatus(result),
            meta,
        });
    } catch (err) {
        // A logging failure must NEVER surface to the caller of
        // notificationEngine.send() — delivery already happened (or
        // didn't) independently of whether we could record it. Logged at
        // error level so it's visible in server logs without affecting
        // any HTTP response or business flow.
        console.error("NOTIFICATION_LOG_ERROR", err);
    }
}