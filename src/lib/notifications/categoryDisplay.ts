// src/lib/notifications/categoryDisplay.ts
//
// FoodKnock Notification Engine — category chip display config.
//
// One place mapping NotificationCategory → a human label + color, shared
// by NotificationCard (Inbox) and NotificationPreview (Admin Studio) so
// the two surfaces are always visually consistent — a category never
// renders as "Offer" in orange on one screen and "offer" in blue on the
// other. Adding a new category to types.ts means adding one entry here.

import type { NotificationCategory, NotificationPriority } from "./types";

export type CategoryDisplay = { label: string; bg: string; fg: string };

export const CATEGORY_DISPLAY: Record<NotificationCategory, CategoryDisplay> = {
    order_update: { label: "Order Update", bg: "bg-sky-100", fg: "text-sky-700" },
    offer: { label: "Offer", bg: "bg-orange-100", fg: "text-orange-700" },
    reward: { label: "Reward", bg: "bg-amber-100", fg: "text-amber-700" },
    lunch_deal: { label: "Lunch Deal", bg: "bg-orange-100", fg: "text-orange-700" },
    evening_deal: { label: "Evening Deal", bg: "bg-violet-100", fg: "text-violet-700" },
    festival: { label: "Festival", bg: "bg-rose-100", fg: "text-rose-700" },
    flash_sale: { label: "Flash Sale", bg: "bg-red-100", fg: "text-red-700" },
    price_drop: { label: "Price Drop", bg: "bg-emerald-100", fg: "text-emerald-700" },
    system: { label: "System", bg: "bg-stone-100", fg: "text-stone-600" },
    general: { label: "General", bg: "bg-stone-100", fg: "text-stone-600" },
};

export type PriorityDisplay = { label: string; fg: string; show: boolean };

/**
 * `show: false` for low/normal — most notifications shouldn't visually
 * shout about their own priority; the indicator is reserved for high/
 * urgent, where it actually helps the reader triage at a glance.
 */
export const PRIORITY_DISPLAY: Record<NotificationPriority, PriorityDisplay> = {
    low: { label: "Low", fg: "text-stone-400", show: false },
    normal: { label: "Normal", fg: "text-stone-400", show: false },
    high: { label: "High Priority", fg: "text-orange-600", show: true },
    urgent: { label: "Urgent", fg: "text-red-600", show: true },
};