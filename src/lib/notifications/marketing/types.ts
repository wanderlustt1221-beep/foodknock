// src/lib/notifications/marketing/types.ts
//
// FoodKnock Notification Engine — Marketing Library types.
//
// Deliberately a SEPARATE, finer-grained taxonomy from NotificationCategory
// (types.ts). NotificationCategory answers "which preference toggle gates
// this" — a broad, fixed set of ~10 values matching the Notification
// Settings UI. MarketingSlot answers "which specific pool of copy should
// the rotation engine pick from" — a much finer set (lunch vs breakfast vs
// tea_time are all distinct content pools, even when several map to the
// same gating category). Every template declares both: `slot` for content
// selection, `category` for gating.

import type { NotificationCategory, NotificationPriority } from "../types";

export type MarketingSlot =
    // Time of day
    | "morning" | "breakfast" | "lunch" | "tea_time" | "evening" | "dinner" | "late_night"
    // Calendar / weather
    | "weekend" | "sunday" | "rain" | "cold_weather" | "summer"
    // Festival
    | "festival_diwali" | "festival_holi" | "festival_independence_day"
    | "festival_republic_day" | "festival_raksha_bandhan" | "festival_valentine"
    | "birthday"
    // Commerce
    | "offer" | "combo"
    // Menu-specific
    | "menu_burger" | "menu_pizza" | "menu_momos" | "menu_sandwich" | "menu_shakes"
    | "new_menu" | "best_seller"
    // Lifecycle / retention
    | "comeback_user" | "inactive_user"
    | "loyalty" | "reward" | "referral"
    | "review_reminder" | "abandoned_cart";

export type MarketingNotificationTemplate = {
    /** Stable unique id — used by the rotation engine to track "recently shown", never displayed. */
    id: string;
    slot: MarketingSlot;
    /** Which Notification Settings toggle gates this template — see preferences.ts */
    category: NotificationCategory;
    title: string;
    body: string;
    ctaLabel: string;
    url: string;
    priority: NotificationPriority;
    imageUrl?: string;
    tag?: string;
};