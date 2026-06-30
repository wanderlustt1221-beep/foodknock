// src/lib/notifications/index.ts
// FoodKnock Notification Engine — public entry point.
//
// Business modules and route handlers should import ONLY from this file
// (or directly from "@/lib/notifications"), never from engine.ts,
// providers/*, or events/emitter.ts directly. This keeps the import graph
// enforceable: one door in, no shortcuts to internals.

export { notificationEngine } from "./engine";
export { notificationEvents } from "./events/emitter";
export type {
    DeliveryProvider,
    DeliveryResult,
    NotificationChannel,
    NotificationEvent,
    NotificationEventName,
    NotificationPayload,
    NotificationTarget,
} from "./types";
export type { NotificationSlot } from "./templates";