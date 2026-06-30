"use client";

// src/components/admin/notifications/NotificationPreview.tsx
//
// FoodKnock Notification Engine — Admin Preview (Feature 3, Part 10).
//
// A presentational-only component: it renders the same rich fields the
// Inbox card renders (NotificationCard.tsx) and the same category/priority
// display config (categoryDisplay.ts) — same visual language across both
// the recipient-facing Inbox and the admin's preview, so "what the admin
// sees before sending" is an honest preview of "what the recipient sees
// after sending", not a separate, divergent mockup.
//
// Reusable: takes plain props, not a NotificationLog/NotificationPayload
// directly, so it can be dropped into the broadcast form (this phase) and
// any future composer (scheduled campaigns, A/B variants) without coupling
// to where the data came from.

import { Bell, Flame } from "lucide-react";
import { cdnImage } from "@/lib/cdnImage";
import { CATEGORY_DISPLAY, PRIORITY_DISPLAY } from "@/lib/notifications/categoryDisplay";
import type { NotificationCategory, NotificationPriority } from "@/lib/notifications/types";

export type NotificationPreviewProps = {
    title: string;
    body: string;
    imageUrl?: string;
    badgeText?: string;
    accentColor?: string;
    category?: NotificationCategory;
    priority?: NotificationPriority;
    ctaLabels?: string[];
};

export default function NotificationPreview({
    title,
    body,
    imageUrl,
    badgeText,
    accentColor = "#FF5C1A",
    category,
    priority = "normal",
    ctaLabels = [],
}: NotificationPreviewProps) {
    const categoryDisplay = category ? CATEGORY_DISPLAY[category] : null;
    const priorityDisplay = PRIORITY_DISPLAY[priority];
    const hasContent = title.trim().length > 0 || body.trim().length > 0;

    return (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400">
                Preview — exactly what subscribers will see
            </p>

            {/* Phone-notification mockup */}
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                <div className="flex items-start gap-2.5 p-3">
                    <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: `linear-gradient(135deg, ${accentColor}, #FFB347)` }}
                    >
                        <Bell size={14} className="text-white" strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-stone-500">FoodKnock</span>
                            <span className="text-[10px] text-stone-400">now</span>
                        </div>

                        {hasContent ? (
                            <>
                                <p className="mt-0.5 text-[13px] font-bold leading-snug text-stone-900">
                                    {title || "Notification title"}
                                </p>
                                <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-stone-600">
                                    {body || "Notification message"}
                                </p>
                            </>
                        ) : (
                            <p className="mt-0.5 text-[12px] italic text-stone-400">
                                Start typing to see a live preview…
                            </p>
                        )}

                        {(categoryDisplay || priorityDisplay.show) && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                                {categoryDisplay && (
                                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${categoryDisplay.bg} ${categoryDisplay.fg}`}>
                                        {categoryDisplay.label}
                                    </span>
                                )}
                                {priorityDisplay.show && (
                                    <span className={`flex items-center gap-0.5 text-[9px] font-bold ${priorityDisplay.fg}`}>
                                        <Flame size={9} className="fill-current" />
                                        {priorityDisplay.label}
                                    </span>
                                )}
                            </div>
                        )}

                        {imageUrl && (
                            <div className="relative mt-2 overflow-hidden rounded-lg border border-stone-100">
                                {badgeText && (
                                    <span
                                        className="absolute left-1.5 top-1.5 z-10 rounded-md px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm"
                                        style={{ background: accentColor }}
                                    >
                                        {badgeText}
                                    </span>
                                )}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={cdnImage(imageUrl, 480)}
                                    alt=""
                                    className="h-24 w-full object-cover"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {ctaLabels.length > 0 && (
                    <div className="flex gap-2 border-t border-stone-100 px-3 py-2">
                        {ctaLabels.map((label, i) => (
                            <span
                                key={i}
                                className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-bold text-orange-600"
                            >
                                {label}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}