// src/lib/notifications/providers/webPushProvider.ts
// FoodKnock Notification Engine — Web Push delivery provider.
//
// This is the existing src/lib/webpush.ts send/broadcast logic, moved
// behind the DeliveryProvider contract. Behavior is unchanged: same VAPID
// setup, same per-subscription send/expire/fail handling, same DB updates.

import webpush from "web-push";
import { connectDB } from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";
import type {
    DeliveryProvider,
    DeliveryResult,
    NotificationAction,
    NotificationPayload,
    NotificationTarget,
} from "../types";

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL   = process.env.VAPID_CONTACT_EMAIL ?? "foodknock20@gmail.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC, VAPID_PRIVATE);
} else {
    console.error("WEBPUSH_INIT_ERROR: Missing VAPID keys in environment");
}

type PushSubscriptionDoc = {
    _id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
};

type WebPushPayload = {
    title: string;
    body: string;
    url: string;
    icon?: string;
    badge?: string;
    actions?: NotificationAction[];
    /** Large hero image — Chrome/Android render this as the notification's banner image. */
    image?: string;
    tag?: string;
};

function toWebPushPayload(payload: NotificationPayload): WebPushPayload {
    return {
        title: payload.title,
        body:  payload.body,
        url:   payload.url ?? "/menu",
        icon:  payload.icon ?? "/icon-192.png",
        badge: payload.badge ?? "/icon-192.png",
        // Omit entirely when not provided — sw.js falls back to its existing
        // hardcoded "Order Now / Later" actions, preserving current campaign
        // behavior exactly as before.
        ...(payload.actions?.length ? { actions: payload.actions } : {}),
        // Rich Notifications (Feature 3) — both optional, both omitted
        // entirely when unset so a payload with neither produces a wire
        // payload byte-for-byte identical to before this was added.
        ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
        ...(payload.tag ? { tag: payload.tag } : {}),
    };
}

async function sendToSubscription(
    sub: PushSubscriptionDoc,
    payload: WebPushPayload
): Promise<"sent" | "expired" | "failed"> {
    const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
    };

    try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        return "sent";
    } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) return "expired";
        console.error(`Push send error for ${sub._id}:`, err);
        return "failed";
    }
}

async function resolveTargetSubscriptions(
    target: NotificationTarget
): Promise<PushSubscriptionDoc[]> {
    await connectDB();

    if (target.subscriptionIds?.length) {
        const docs = await PushSubscription
            .find({ _id: { $in: target.subscriptionIds }, isActive: true })
            .lean();
        return docs.map((d) => ({
            _id: d._id.toString(),
            endpoint: d.endpoint,
            p256dh: d.p256dh,
            auth: d.auth,
        }));
    }

    if (target.userId) {
        const docs = await PushSubscription
            .find({ user: target.userId, isActive: true })
            .lean();
        return docs.map((d) => ({
            _id: d._id.toString(),
            endpoint: d.endpoint,
            p256dh: d.p256dh,
            auth: d.auth,
        }));
    }

    if (target.broadcast) {
        const docs = await PushSubscription.find({ isActive: true }).lean();
        return docs.map((d) => ({
            _id: d._id.toString(),
            endpoint: d.endpoint,
            p256dh: d.p256dh,
            auth: d.auth,
        }));
    }

    return [];
}

export class WebPushProvider implements DeliveryProvider {
    readonly channel = "push" as const;

    async send(target: NotificationTarget, payload: NotificationPayload): Promise<DeliveryResult> {
        const subs = await resolveTargetSubscriptions(target);
        const wpPayload = toWebPushPayload(payload);

        let sent = 0, failed = 0, deactivated = 0;

        await Promise.all(
            subs.map(async (sub) => {
                const result = await sendToSubscription(sub, wpPayload);

                if (result === "sent") {
                    sent++;
                    await PushSubscription.updateOne(
                        { _id: sub._id },
                        { $set: { failCount: 0, isActive: true } }
                    );
                    return;
                }

                failed++;

                if (result === "expired") {
                    await PushSubscription.updateOne(
                        { _id: sub._id },
                        { $set: { isActive: false }, $inc: { failCount: 1 } }
                    );
                    deactivated++;
                    return;
                }

                await PushSubscription.updateOne({ _id: sub._id }, { $inc: { failCount: 1 } });
            })
        );

        return { channel: "push", sent, failed, deactivated };
    }
}

export const webPushProvider = new WebPushProvider();