export const dynamic = "force-dynamic";

// src/app/api/notifications/[id]/read/route.ts
//
// PATCH — marks one notification as read. The `user: userId` filter in the
// update query IS the authorization check: a user can never mark another
// user's notification as read, even by guessing a valid _id — the query
// simply matches zero documents for someone else's row, same as if it
// didn't exist. Idempotent: only transitions readAt from null to now, so
// re-marking an already-read notification is a harmless no-op that
// preserves the original first-read timestamp.

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import NotificationLog from "@/models/NotificationLog";
import { verifyToken } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

function getUserId(req: NextRequest): string | null {
    const cookieHeader = req.headers.get("cookie") ?? "";
    const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : null;
    if (!token) return null;
    try {
        const decoded = verifyToken(token) as { userId?: string };
        return decoded?.userId ?? null;
    } catch {
        return null;
    }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
    const userId = getUserId(req);
    if (!userId) {
        return NextResponse.json(
            { success: false, message: "Unauthorised" },
            { status: 401 }
        );
    }

    try {
        const { id } = await context.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json(
                { success: false, message: "Invalid notification ID" },
                { status: 400 }
            );
        }

        await connectDB();

        await NotificationLog.findOneAndUpdate(
            { _id: id, user: userId, readAt: null },
            { $set: { readAt: new Date() } }
        );

        // Always success, whether this was the transition that marked it
        // read, or it was already read — either way the client's desired
        // end state (this notification is read) is now true.
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("NOTIFICATION_MARK_READ_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to update notification" },
            { status: 500 }
        );
    }
}