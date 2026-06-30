export const dynamic = "force-dynamic";

// src/app/api/notifications/route.ts
//
// GET — paginated inbox list for the CURRENT authenticated user only.
// Cursor-based pagination (see inboxQuery.ts) for "load more" / infinite
// scroll on the client. Auth pattern matches every other authenticated
// route in this codebase: extract `token` cookie, verify, require a userId
// — no shared auth helper exists in this project (each route is
// self-contained), so this follows that same convention rather than
// introducing a new one.

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { fetchInboxPage, fetchUnreadCount } from "@/lib/notifications/inboxQuery";

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

export async function GET(req: NextRequest) {
    const userId = getUserId(req);
    if (!userId) {
        return NextResponse.json(
            { success: false, message: "Unauthorised" },
            { status: 401 }
        );
    }

    try {
        const cursor = req.nextUrl.searchParams.get("cursor");
        const [page, unreadCount] = await Promise.all([
            fetchInboxPage(userId, cursor),
            fetchUnreadCount(userId),
        ]);

        return NextResponse.json({
            success: true,
            items: page.items,
            nextCursor: page.nextCursor,
            hasMore: page.hasMore,
            unreadCount,
        });
    } catch (error) {
        console.error("NOTIFICATIONS_INBOX_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to load notifications" },
            { status: 500 }
        );
    }
}