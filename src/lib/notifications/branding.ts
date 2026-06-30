// src/lib/notifications/branding.ts
//
// FoodKnock Notification Engine — central branding.
//
// "No caller should manually provide icon/badge/accent color — branding
// happens centrally." This is the one function that does it, called from
// exactly one place: engine.ts's send(), the same chokepoint every
// notification already passes through regardless of how it originated
// (event-driven via emit()/handleEvent(), or direct via send()). That
// means zero changes were needed to any existing template file
// (templates.ts, transactionalTemplates.ts) to pick up branding — they
// keep building payloads exactly as before, and this fills in the gaps
// on the way out.
//
// Adding a new brand-default field later (e.g. a sound, a vibration
// pattern) means adding one line here — not touching every template.

import type { NotificationPayload } from "./types";

export const BRAND = {
    name: "FoodKnock",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    accentColor: "#FF5C1A",
} as const;

/**
 * Fills in FoodKnock brand defaults for any field a caller/template left
 * unset. Never overwrites a value that's already present — a template
 * that deliberately sets a festival-specific accentColor, for instance,
 * keeps it; only the gaps get the brand default.
 */
export function applyBranding(payload: NotificationPayload): NotificationPayload {
    return {
        ...payload,
        icon: payload.icon ?? BRAND.icon,
        badge: payload.badge ?? BRAND.badge,
        accentColor: payload.accentColor ?? BRAND.accentColor,
        priority: payload.priority ?? "normal",
        category: payload.category ?? "general",
    };
}