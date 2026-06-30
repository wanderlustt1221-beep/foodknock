export const dynamic = "force-dynamic";

// src/app/api/notifications/read-all/route.ts
//
// PATCH — marks every currently-unread, inbox-eligible notification as
// read for the calling user. Scoped entirely by the `user: userId` filter,
// same authorization model as the single-item read route.

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import NotificationLog from "@/models/NotificationLog";
import { verifyToken } from "@/lib/auth";
import { INBOX_EXCLUDED_EVENTS } from "@/lib/notifications/inboxQuery";

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

export async function PATCH(req: NextRequest) {
    const userId = getUserId(req);
    if (!userId) {
        return NextResponse.json(
            { success: false, message: "Unauthorised" },
            { status: 401 }
        );
    }

    try {
        await connectDB();

        const result = await NotificationLog.updateMany(
            { user: userId, event: { $nin: INBOX_EXCLUDED_EVENTS }, readAt: null },
            { $set: { readAt: new Date() } }
        );

        return NextResponse.json({
            success: true,
            updated: result.modifiedCount ?? 0,
        });
    } catch (error) {
        console.error("NOTIFICATIONS_MARK_ALL_READ_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to update notifications" },
            { status: 500 }
        );
    }
}