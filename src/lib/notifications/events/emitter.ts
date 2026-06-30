// src/lib/notifications/events/emitter.ts
// FoodKnock Notification Engine — event bus.
//
// Business modules call `notificationEvents.emit(...)` and never know who
// is listening or how delivery happens. The Notification Engine is the
// only subscriber registered today (see engine.ts bootstrap).

import { EventEmitter } from "events";
import type { NotificationEvent, NotificationEventName } from "../types";

class NotificationEventBus {
    private emitter = new EventEmitter();

    constructor() {
        // Business events can fan out to multiple channels per listener;
        // raise the default ceiling so EventEmitter doesn't warn/drop.
        this.emitter.setMaxListeners(50);
    }

    emit<TData = Record<string, unknown>>(event: NotificationEvent<TData>): void {
        this.emitter.emit(event.name, event);
    }

    on<TData = Record<string, unknown>>(
        name: NotificationEventName,
        handler: (event: NotificationEvent<TData>) => void
    ): void {
        this.emitter.on(name, handler);
    }

    off<TData = Record<string, unknown>>(
        name: NotificationEventName,
        handler: (event: NotificationEvent<TData>) => void
    ): void {
        this.emitter.off(name, handler);
    }
}

// Singleton — survives across hot-reloads in dev via globalThis caching,
// same pattern as the existing Mongoose model guard in src/models/User.ts.
const globalForEvents = globalThis as unknown as {
    __fkNotificationEvents?: NotificationEventBus;
};

export const notificationEvents =
    globalForEvents.__fkNotificationEvents ?? new NotificationEventBus();

if (process.env.NODE_ENV !== "production") {
    globalForEvents.__fkNotificationEvents = notificationEvents;
}