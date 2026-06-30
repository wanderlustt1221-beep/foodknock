// src/lib/notifications/preferenceConstants.ts
//
// FoodKnock Notification Engine — client-safe preference constants.
//
// Extracted from preferences.ts to fix a server/client boundary violation:
// preferences.ts imports connectDB/mongoose/User (server-only), so any
// client component importing ANYTHING from it — even just one constant —
// pulls the entire module graph into the client bundle, and Next.js's
// client bundler then fails trying to resolve mongoose's Node-only
// dependencies (net, tls, child_process, fs/promises).
//
// This file contains ONLY plain types and constants — zero imports, zero
// runtime dependencies on anything. That's deliberate and load-bearing:
// because this file imports nothing, no future edit to it can accidentally
// reintroduce a server-only dependency into the client bundle through it.
//
// Safe for both "use client" components and server code to import.
// preferences.ts (server-only) reads its defaults from here.
// NotificationSettings.tsx (client) reads its labels from here directly,
// and must never import preferences.ts itself.

export type NotificationPreferenceKey =
    | "orderUpdates"
    | "offers"
    | "rewards"
    | "lunchDeals"
    | "eveningDeals"
    | "festivalOffers"
    | "flashSales"
    | "priceDrops"
    | "systemUpdates";

export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

export const NOTIFICATION_PREFERENCE_DEFAULTS: NotificationPreferences = {
    orderUpdates: true,
    offers: true,
    rewards: true,
    lunchDeals: true,
    eveningDeals: true,
    festivalOffers: true,
    flashSales: true,
    priceDrops: true,
    systemUpdates: true,
};

/** Human-readable labels for the settings UI — one source, not duplicated in components. */
export const NOTIFICATION_PREFERENCE_LABELS: Record<NotificationPreferenceKey, string> = {
    orderUpdates: "Order Updates",
    offers: "Offers",
    rewards: "Rewards",
    lunchDeals: "Lunch Deals",
    eveningDeals: "Evening Deals",
    festivalOffers: "Festival Offers",
    flashSales: "Flash Sales",
    priceDrops: "Price Drops",
    systemUpdates: "System Updates",
};