// src/lib/notifications/templates.ts
// FoodKnock Notification Engine — event → payload template registry.
//
// A "template" turns a NotificationEvent into a channel-agnostic
// NotificationPayload. Phase 1 only registers the "push.campaign" template
// (ported verbatim from the existing NOTIFICATION_POOL in src/lib/webpush.ts).
// Later phases register templates for order.placed, auth.otp_requested, etc.
// without touching the engine or providers.

import type { NotificationEvent, NotificationPayload } from "./types";

export type NotificationSlot = "morning" | "evening";

type SlotMessage = {
    slot: NotificationSlot;
    title: string;
    body: string;
    url: string;
};

export const PUSH_CAMPAIGN_POOL: SlotMessage[] = [
    {
        slot: "morning",
        title: "🍔 Aaj ka lunch sorted?",
        body: "Fresh burgers, momos, pizza — sab ready hai FoodKnock pe!",
        url: "/menu",
    },
    {
        slot: "morning",
        title: "😋 Bhook lag rahi hai na?",
        body: "FoodKnock ka desi twist wala burger try kiya? Abhi order karo!",
        url: "/menu",
    },
    {
        slot: "morning",
        title: "🍕 Pizza ya burger?",
        body: "Dono mil sakte hain — aaj lunch FoodKnock ke saath karo.",
        url: "/menu",
    },
    {
        slot: "morning",
        title: "☀️ Good morning, foodie!",
        body: "Sab kuch fresh ban raha hai. Aaj lunch kahan se hoga?",
        url: "/menu",
    },
    {
        slot: "morning",
        title: "🥪 Office lunch sorted nahi hai?",
        body: "FoodKnock — delivery 25 min mein. Order abhi karo!",
        url: "/menu",
    },
    {
        slot: "evening",
        title: "🧋 Evening snack time! 👀",
        body: "Cold shake + fries = perfect break. FoodKnock pe order karo!",
        url: "/menu",
    },
    {
        slot: "evening",
        title: "🍟 Fries ka mood hai?",
        body: "Crispy fries aur ek chilled shake — yahi chahiye abhi!",
        url: "/menu",
    },
    {
        slot: "evening",
        title: "🌙 Raat ka khaana soch liya?",
        body: "Pizza, momos, ya burger — jo bhi ho, FoodKnock deliver karega.",
        url: "/menu",
    },
    {
        slot: "evening",
        title: "🍦 Ice cream ka time aa gaya!",
        body: "Aaj ki shaam FoodKnock ke saath meethi karo. Order karo!",
        url: "/menu",
    },
    {
        slot: "evening",
        title: "😍 Aaj momos khaya? Nahi na!",
        body: "Steamy hot momos ready hain. 25 min mein door pe. Order karo!",
        url: "/menu",
    },
];

export function pickCampaignMessage(slot: NotificationSlot): SlotMessage {
    const pool = PUSH_CAMPAIGN_POOL.filter((m) => m.slot === slot);
    return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Builds the push payload for a "push.campaign" event. `event.data.slot`
 * is required — set by whoever emits the event (currently the cron route).
 * Maps slot → category so the Lunch Deals / Evening Deals preference
 * toggles (Notification Settings) actually gate this campaign — without
 * this mapping, applyBranding() would default every campaign send to
 * category "general", which is never gated by any toggle.
 */
function buildPushCampaignPayload(event: NotificationEvent<{ slot: NotificationSlot }>): NotificationPayload {
    const msg = pickCampaignMessage(event.data.slot);
    return {
        title: msg.title,
        body: msg.body,
        url: msg.url,
        category: event.data.slot === "morning" ? "lunch_deal" : "evening_deal",
        ctaButtons: [{ id: "explore", label: "Explore Menu", url: msg.url }],
    };
}

export type AdminBroadcastEventData = {
    title: string;
    body: string;
    url?: string;
    imageUrl?: string;
    category?: NotificationPayload["category"];
    priority?: NotificationPayload["priority"];
    accentColor?: string;
    badgeText?: string;
    ctaButtons?: NotificationPayload["ctaButtons"];
    campaignId?: string;
};

/**
 * Builds the push payload for an "admin.broadcast" event — an ad-hoc
 * notification authored in the Admin Notification Center. Unlike
 * push.campaign (which picks from a fixed copy pool), the admin supplies
 * everything directly; this is a thin pass-through, not a template that
 * generates content. Rich fields are all optional — an admin who only
 * fills in title/body (the original Phase 3 form) gets exactly the
 * original behavior, now additionally branded by applyBranding().
 */
function buildAdminBroadcastPayload(event: NotificationEvent<AdminBroadcastEventData>): NotificationPayload {
    return {
        title: event.data.title,
        body: event.data.body,
        url: event.data.url || "/menu",
        imageUrl: event.data.imageUrl,
        category: event.data.category,
        priority: event.data.priority,
        accentColor: event.data.accentColor,
        badgeText: event.data.badgeText,
        ctaButtons: event.data.ctaButtons,
        campaignId: event.data.campaignId,
    };
}

/**
 * Registry: event name → payload builder. Only "push.campaign" is wired
 * in Phase 1; other event names declared in types.ts have no template yet
 * and the engine will simply no-op for them until a later phase adds one.
 */
export const notificationTemplates: Partial<
    Record<string, (event: NotificationEvent<any>) => NotificationPayload>
> = {
    "push.campaign": buildPushCampaignPayload,
    "admin.broadcast": buildAdminBroadcastPayload,
};