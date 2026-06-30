// src/lib/webpush.ts
// FoodKnock — backward-compatible shim.
//
// The real implementation now lives in src/lib/notifications/* behind the
// DeliveryProvider/engine architecture. This file is kept so any existing
// caller importing `broadcastCampaign`, `pickMessage`, `NOTIFICATION_POOL`,
// or `NotificationSlot` from "@/lib/webpush" keeps working unchanged.
//
// New code should import from "@/lib/notifications" instead.

import { notificationEngine } from "@/lib/notifications/engine";
import {
    PUSH_CAMPAIGN_POOL as NOTIFICATION_POOL,
    pickCampaignMessage as pickMessage,
    type NotificationSlot,
} from "@/lib/notifications/templates";

export type { NotificationSlot };
export { NOTIFICATION_POOL, pickMessage };

export async function broadcastCampaign(slot: NotificationSlot): Promise<{
    sent: number;
    failed: number;
    deactivated: number;
}> {
    const msg = pickMessage(slot);

    const [result] = await notificationEngine.send(
        ["push"],
        { broadcast: true },
        {
            title: msg.title,
            body: msg.body,
            url: msg.url,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
        }
    );

    return {
        sent: result?.sent ?? 0,
        failed: result?.failed ?? 0,
        deactivated: result?.deactivated ?? 0,
    };
}