export const dynamic = "force-dynamic";

// src/app/api/admin/orders/[id]/status/route.ts
//
// PATCH /api/admin/orders/:id/status
//
// Updates an order's status.  When the new status is "delivered" this route
// calls handleOrderDelivered() which:
//   • awards order_reward points to the customer
//   • on the customer's very first delivered order, also fires the referral
//     bonuses (referral_referee to the customer, referral_referrer to the
//     person who referred them)
//
// All loyalty writes are idempotent — clicking "Mark Delivered" a second
// time is completely safe and simply logs a skip message.
//
// Order-delivered email (fire-and-forget at the route boundary) is fully
// awaited internally inside its own try/catch.
//
// ── Auth ──────────────────────────────────────────────────────────────────
// This route is admin-only.  It verifies the JWT and checks role === "admin"
// before touching any data.

import { NextRequest, NextResponse } from "next/server";
import { connectDB }   from "@/lib/db";
import Order           from "@/models/Order";
import User            from "@/models/User";
import { verifyToken } from "@/lib/auth";
import { handleOrderDelivered } from "@/lib/loyaltyService";
import { sendOrderDeliveredEmail } from "@/lib/mailer";
import { notificationEngine } from "@/lib/notifications";

// Valid status transitions in the order lifecycle
const VALID_STATUSES = [
    "received",
    "preparing",
    "out_for_delivery",
    "delivered",
    "cancelled",
] as const;

type OrderStatus = (typeof VALID_STATUSES)[number];

// ── Auth helper ────────────────────────────────────────────────────────────
function getAdminFromCookie(req: NextRequest): { userId: string; role: string } | null {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const match        = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const token        = match ? decodeURIComponent(match[1]) : null;
    if (!token) return null;
    try {
        const decoded = verifyToken(token) as { userId?: string; role?: string };
        if (!decoded?.userId || !decoded?.role) return null;
        return { userId: decoded.userId, role: decoded.role };
    } catch {
        return null;
    }
}

// ── PATCH handler ──────────────────────────────────────────────────────────
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    // ── 1. Auth check ──────────────────────────────────────────────────────
    const admin = getAdminFromCookie(req);
    if (!admin) {
        return NextResponse.json(
            { success: false, message: "Not authenticated" },
            { status: 401 }
        );
    }
    if (admin.role !== "admin") {
        return NextResponse.json(
            { success: false, message: "Admin access required" },
            { status: 403 }
        );
    }

    // ── 2. Parse + validate body ───────────────────────────────────────────
    let body: { status?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { success: false, message: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const newStatus = body?.status as OrderStatus | undefined;
    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
        return NextResponse.json(
            {
                success: false,
                message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
            },
            { status: 400 }
        );
    }

    // ── 3. Fetch + update the order ────────────────────────────────────────
    await connectDB();

    const { id } = await params;
const order = await Order.findById(id);
    if (!order) {
        return NextResponse.json(
            { success: false, message: "Order not found" },
            { status: 404 }
        );
    }

    const previousStatus = order.status;
    order.status         = newStatus;
    await order.save();

    // ── 4. Loyalty hook — fires only on the delivered transition ───────────
    //
    // We check previousStatus !== "delivered" so that if an admin corrects a
    // mis-click (delivered → preparing → delivered again) the idempotency
    // guard inside handleOrderDelivered() catches the duplicate and skips it
    // safely.  We still call through so the log line is emitted and you can
    // see it was checked.
    if (newStatus === "delivered") {
        // Fire-and-forget with explicit error capture so a loyalty failure
        // never rolls back the status change the admin just made.
        handleOrderDelivered(order._id.toString()).catch((err) => {
            console.error(`[loyalty] handleOrderDelivered failed for order ${order._id}:`, err);
        });

        // ── Order-delivered email — only on the genuine transition ────────
        // Guarded by previousStatus so a redundant re-click (already
        // "delivered", admin clicks it again) never re-sends the email.
        // Skipped for guest orders with no linked user (no email was ever
        // collected at checkout in that case).
        if (previousStatus !== "delivered" && order.user) {
            try {
                const freshUser = await User.findById(order.user).select("email name").lean() as { email?: string } | null;
                const customerEmail = freshUser?.email;
                if (customerEmail) {
                    await sendOrderDeliveredEmail(customerEmail, {
                        customerName: order.customerName,
                        orderId:      order.orderId,
                    });
                }
            } catch (err) {
                console.error(`[email] order-delivered email failed for order ${order._id}:`, err);
            }

            // ── Push + WhatsApp via the existing Notification Engine ──────
            // Same gate as email above (genuine transition, real linked
            // user) — a guest order with no `order.user` has no push
            // subscriptions and no phone to message either, exactly the
            // same reason email is skipped for it.
            //
            // One emit() call. Push and WhatsApp both fire from it because
            // notifications/engine.ts's own EVENT_DEFAULT_CHANNELS already
            // maps "order.delivered" to ["push", "whatsapp"] — that mapping
            // already existed before this change; nothing about channel
            // selection lives in this route. The payload itself is built
            // by the existing buildOrderDeliveredPayload in
            // transactionalTemplates.ts (reused, not duplicated) — its
            // `data: { orderId, customerName, kind: "order.delivered" }` is
            // exactly what WhatsAppDeliveryProvider's own "order.delivered"
            // case already reads to fill in the existing, already-approved
            // template (review CTA included in that template itself — see
            // whatsapp/templates.ts; nothing here builds or appends a URL).
            //
            // Phase 3.5 audit note: emit() returns void, not a Promise (see
            // engine.ts) — this try/catch can only ever catch a SYNCHRONOUS
            // throw from constructing/dispatching the event itself (verified
            // directly: a failure inside the async work that follows, e.g. a
            // provider erroring, becomes an unhandled rejection this block
            // structurally cannot observe, regardless of whether it's
            // wrapped in try/catch or not). That's fine — it's not this
            // try/catch's job to isolate delivery failures; that's
            // engine.ts's send() loop, which independently catches each
            // provider's own exception per-channel (fixed in this same
            // audit pass — see that file). This block mirrors the same
            // try/catch-around-emit() convention already used identically
            // in createOrderCore.ts and orders/[id]/route.ts, for the exact
            // same reason: guarding this block's own construction of the
            // event object, not the asynchronous delivery that follows it.
            try {
                notificationEngine.emit({
                    name: "order.delivered",
                    data: { orderId: order.orderId, customerName: order.customerName },
                    target: { userId: order.user.toString() },
                });
            } catch (err) {
                console.error(`[notify] order.delivered emit failed for order ${order._id}:`, err);
            }
        }
    }

    return NextResponse.json({
        success:        true,
        message:        `Order status updated to "${newStatus}"`,
        orderId:        order.orderId,
        previousStatus,
        status:         newStatus,
    });
}