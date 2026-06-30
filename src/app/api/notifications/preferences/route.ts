export const dynamic = "force-dynamic";

// src/app/api/notifications/preferences/route.ts
//
// GET   — current user's notification preferences (merged with defaults).
// PATCH — update one or more toggles.
//
// Auth pattern matches every other authenticated route in this codebase
// (extract `token` cookie, verify, require a userId) — no shared auth
// helper exists in this project, so this follows that same convention.

import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
    getNotificationPreferences,
    setNotificationPreferences,
    NOTIFICATION_PREFERENCE_LABELS,
} from "@/lib/notifications/preferences";

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
        return NextResponse.json({ success: false, message: "Unauthorised" }, { status: 401 });
    }

    try {
        const preferences = await getNotificationPreferences(userId);
        return NextResponse.json({
            success: true,
            preferences,
            labels: NOTIFICATION_PREFERENCE_LABELS,
        });
    } catch (error) {
        console.error("NOTIFICATION_PREFERENCES_GET_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to load preferences" },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest) {
    const userId = getUserId(req);
    if (!userId) {
        return NextResponse.json({ success: false, message: "Unauthorised" }, { status: 401 });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const preferences = await setNotificationPreferences(userId, body);
        return NextResponse.json({ success: true, preferences });
    } catch (error) {
        console.error("NOTIFICATION_PREFERENCES_PATCH_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to update preferences" },
            { status: 500 }
        );
    }
}