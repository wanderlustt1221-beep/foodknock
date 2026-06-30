export const dynamic = "force-dynamic";

// src/app/api/admin/notifications/broadcast/route.ts
//
// Admin Notification Center API.
//
// Two actions, one endpoint:
//   • mode: "test"      → send only to the calling admin's own subscription
//                          (identified by the endpoint their browser already
//                          holds — resolved to a subscriptionId server-side)
//   • mode: "broadcast" → send to every active push subscriber
//
// Both modes flow through notificationEngine.send(...) — the same direct-send
// path already used by the cron campaign route. This API never imports
// web-push or touches PushSubscription docs for delivery; it only resolves
// the test-mode endpoint to an _id so the engine can target it.
//
// Auth: same cookie + role pattern as the existing isAdmin() helper in
// src/app/api/orders/route.ts.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import PushSubscription from "@/models/PushSubscription";
import { verifyToken } from "@/lib/auth";
import { notificationEngine } from "@/lib/notifications";

function isAdmin(req: NextRequest): boolean {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const match        = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const token        = match ? decodeURIComponent(match[1]) : null;
    if (!token) return false;
    try {
        const decoded = verifyToken(token) as { role?: string };
        return decoded?.role === "admin";
    } catch {
        return false;
    }
}

type BroadcastBody = {
    mode: "test" | "broadcast";
    title: string;
    body: string;
    url?: string;
    /** Required for mode: "test" — the calling browser's own push endpoint. */
    endpoint?: string;
    // ── Rich payload (Feature 3, Part 10) — all optional. An admin who only
    // fills in the original title/body/url form gets exactly the original
    // behavior; these just flow through to NotificationPayload untouched.
    imageUrl?: string;
    category?: string;
    priority?: string;
    accentColor?: string;
    badgeText?: string;
    ctaButtons?: Array<{ id: string; label: string; url?: string }>;
    campaignId?: string;
};

export async function POST(req: NextRequest) {
    if (!isAdmin(req)) {
        return NextResponse.json(
            { success: false, message: "Unauthorised" },
            { status: 401 }
        );
    }

    try {
        await connectDB();

        const data = (await req.json()) as Partial<BroadcastBody>;
        const {
            mode, title, body, url, endpoint,
            imageUrl, category, priority, accentColor, badgeText, ctaButtons, campaignId,
        } = data;

        if (mode !== "test" && mode !== "broadcast") {
            return NextResponse.json(
                { success: false, message: 'mode must be "test" or "broadcast"' },
                { status: 400 }
            );
        }

        if (!title?.trim() || !body?.trim()) {
            return NextResponse.json(
                { success: false, message: "Title and message are required" },
                { status: 400 }
            );
        }

        const safeUrl = url?.trim() || "/menu";

        // Validate against the known unions rather than trusting arbitrary
        // request-body strings — an invalid value is simply omitted (falls
        // back to applyBranding()'s defaults) rather than passed through.
        const VALID_CATEGORIES = [
            "order_update", "offer", "reward", "lunch_deal", "evening_deal",
            "festival", "flash_sale", "price_drop", "system", "general",
        ];
        const VALID_PRIORITIES = ["low", "normal", "high", "urgent"];

        const richPayloadFields = {
            ...(imageUrl ? { imageUrl } : {}),
            ...(category && VALID_CATEGORIES.includes(category) ? { category: category as any } : {}),
            ...(priority && VALID_PRIORITIES.includes(priority) ? { priority: priority as any } : {}),
            ...(accentColor ? { accentColor } : {}),
            ...(badgeText ? { badgeText } : {}),
            ...(Array.isArray(ctaButtons) && ctaButtons.length > 0 ? { ctaButtons } : {}),
            ...(campaignId ? { campaignId } : {}),
        };

        // ── Test mode — only the admin's own subscription ──────────────────
        if (mode === "test") {
            if (!endpoint) {
                return NextResponse.json(
                    { success: false, message: "endpoint is required for test notifications" },
                    { status: 400 }
                );
            }

            const sub = await PushSubscription
                .findOne({ endpoint, isActive: true })
                .select("_id")
                .lean() as { _id: { toString(): string } } | null;

            if (!sub) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "No active subscription found for this browser. Enable notifications first.",
                    },
                    { status: 404 }
                );
            }

            const [result] = await notificationEngine.send(
                ["push"],
                { subscriptionIds: [sub._id.toString()] },
                { title, body, url: safeUrl, ...richPayloadFields }
            );

            return NextResponse.json({
                success: true,
                mode: "test",
                sent: result?.sent ?? 0,
                failed: result?.failed ?? 0,
            });
        }

        // ── Broadcast mode — all active subscribers ─────────────────────────
        // Uses the same awaited notificationEngine.send(...) path as the
        // existing broadcastCampaign() shim (src/lib/webpush.ts), so the
        // admin sees real sent/failed/deactivated counts instead of firing
        // an unawaited event into the void.
        const [result] = await notificationEngine.send(
            ["push"],
            { broadcast: true },
            { title, body, url: safeUrl, ...richPayloadFields }
        );

        return NextResponse.json({
            success: true,
            mode: "broadcast",
            sent: result?.sent ?? 0,
            failed: result?.failed ?? 0,
            deactivated: result?.deactivated ?? 0,
        });
    } catch (error) {
        console.error("ADMIN_BROADCAST_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to send notification" },
            { status: 500 }
        );
    }
}