const CACHE_NAME = "foodknock-v1";
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([OFFLINE_URL, "/icon-192.png", "/icon-512.png"]);
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (
        event.request.method !== "GET" ||
        !event.request.url.startsWith(self.location.origin)
    ) {
        return;
    }

    event.respondWith(
        fetch(event.request).catch(() =>
            caches.match(event.request).then((r) => r || caches.match(OFFLINE_URL))
        )
    );
});

/**
 * Extracts the actual FoodKnock NotificationPayload from whatever the
 * browser's Push API event.data.json() parsed to. Two genuinely different
 * wire shapes reach this function depending on delivery transport:
 *
 * 1. FCM (Firebase Cloud Messaging) — confirmed via direct debug capture:
 *    { data: { payload: "<json-string>" }, fcmMessageId, priority, ... }
 *    Firebase wraps the data-only message in its own envelope; the actual
 *    NotificationPayload we sent is a JSON STRING nested two levels deep,
 *    at parsed.data.payload — NOT parsed.payload.
 *
 * 2. Raw Web Push (VAPID, via the `web-push` npm package) — sent directly:
 *    webPushProvider.ts calls webpush.sendNotification(sub, JSON.stringify(payload)),
 *    so event.data.json() IS the payload object itself, no wrapper at all.
 *    Detected by the presence of `title`/`body` directly on the parsed object.
 *
 * A defensive flat { payload: "<json-string>" } case is also handled in
 * case a future Firebase SDK version or alternate send path ever changes
 * the envelope shape — this keeps both transports working without either
 * one assuming the other's shape.
 */
function extractNotificationPayload(rawParsed) {
    if (!rawParsed || typeof rawParsed !== "object") return null;

    // Case 1: FCM's actual wire envelope — confirmed via debug capture.
    if (rawParsed.data && typeof rawParsed.data.payload === "string") {
        try {
            return JSON.parse(rawParsed.data.payload);
        } catch {
            return null;
        }
    }

    // Case 2: defensive fallback — flat { payload: "<json-string>" }.
    if (typeof rawParsed.payload === "string") {
        try {
            return JSON.parse(rawParsed.payload);
        } catch {
            return null;
        }
    }

    // Case 3: raw Web Push — payload object sent directly, unwrapped.
    if (typeof rawParsed.title === "string" || typeof rawParsed.body === "string") {
        return rawParsed;
    }

    return null;
}

self.addEventListener("push", (event) => {
    let data = {
        title: "🍔 FoodKnock",
        body: "Something delicious is waiting for you!",
        url: "/menu",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
    };

    try {
        if (event.data) {
            const parsed = event.data.json();
            const unwrapped = extractNotificationPayload(parsed);
            if (unwrapped) {
                data = { ...data, ...unwrapped };
            }
        }
    } catch { }

    // Default actions preserve existing campaign-notification behavior
    // exactly as before. When the Notification Engine sends a payload with
    // its own `actions` array (transactional order-status notifications),
    // those are used instead — this is the only behavioral branch added.
    const defaultActions = [
        { action: "order", title: "Order Now 🍔" },
        { action: "dismiss", title: "Later" },
    ];

    // FIX (Problem 3 — notification overwrite/collapse): a static shared
    // fallback tag ("foodknock-promo") meant EVERY notification without an
    // explicit tag replaced the previous one in the tray — order.placed,
    // order.preparing, order.out_for_delivery, order.delivered, and loyalty
    // credits all lack an explicit `tag` in their templates, so they all
    // shared one slot. A unique-per-notification fallback tag means each
    // one gets its own tray entry unless a payload DELIBERATELY sets its
    // own tag (still fully supported — e.g. for future intentional
    // marketing-notification dedup).
    const fallbackTag = "foodknock-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        data: { url: data.url },
        vibrate: [150, 50, 150],
        requireInteraction: false,
        tag: data.tag || fallbackTag,
        renotify: true,
        actions: Array.isArray(data.actions) && data.actions.length > 0
            ? data.actions
            : defaultActions,
        // Rich Notifications (Feature 3) — large hero/banner image, shown
        // by Chrome/Android when present. Omitted entirely (not even set
        // to undefined) when the payload has no image, so a notification
        // without one renders exactly as before this was added.
        ...(data.image ? { image: data.image } : {}),
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();

    if (event.action === "dismiss") return;

    const targetUrl = event.notification.data?.url ?? "/menu";
    const fullUrl = new URL(targetUrl, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.startsWith(self.location.origin) && "focus" in client) {
                    client.focus();
                    if ("navigate" in client) {
                        return client.navigate(fullUrl);
                    }
                    return;
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(fullUrl);
            }
        })
    );
});