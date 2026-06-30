"use client";

// src/components/notifications/NotificationSettings.tsx
//
// One toggle per category, talking only to /api/notifications/preferences
// — never to the User model or engine directly. Each toggle is optimistic
// (flips instantly, then confirms with the server) with rollback if the
// PATCH fails, so the UI never feels laggy on a fast, normal connection
// but also never silently lies about state on a failed write.

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { Bell, ShoppingBag, Tag, Gift, Sun, Moon, Sparkles, Zap, TrendingDown, Settings2 } from "lucide-react";
import {
    NOTIFICATION_PREFERENCE_LABELS,
    type NotificationPreferenceKey,
    type NotificationPreferences,
} from "@/lib/notifications/preferenceConstants";

const PREFERENCE_ICONS: Record<NotificationPreferenceKey, React.ElementType> = {
    orderUpdates: ShoppingBag,
    offers: Tag,
    rewards: Gift,
    lunchDeals: Sun,
    eveningDeals: Moon,
    festivalOffers: Sparkles,
    flashSales: Zap,
    priceDrops: TrendingDown,
    systemUpdates: Settings2,
};

const PREFERENCE_ORDER: NotificationPreferenceKey[] = [
    "orderUpdates",
    "offers",
    "rewards",
    "lunchDeals",
    "eveningDeals",
    "festivalOffers",
    "flashSales",
    "priceDrops",
    "systemUpdates",
];

type Props = {
    initialPreferences: NotificationPreferences;
};

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button
            role="switch"
            aria-checked={checked}
            onClick={onChange}
            className={[
                "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2",
                checked ? "bg-gradient-to-r from-[#FF5C1A] to-[#FFB347]" : "bg-stone-200",
            ].join(" ")}
        >
            <motion.span
                layout
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
                className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md"
                style={{ left: checked ? "calc(100% - 26px)" : "2px" }}
            />
        </button>
    );
}

export default function NotificationSettings({ initialPreferences }: Props) {
    const [preferences, setPreferences] = useState<NotificationPreferences>(initialPreferences);
    const [pendingKey, setPendingKey] = useState<NotificationPreferenceKey | null>(null);

    const handleToggle = useCallback(
        async (key: NotificationPreferenceKey) => {
            const nextValue = !preferences[key];
            setPreferences((prev) => ({ ...prev, [key]: nextValue }));
            setPendingKey(key);

            try {
                const res = await fetch("/api/notifications/preferences", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ [key]: nextValue }),
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.message || "Failed to update");
            } catch {
                // Roll back — the server write failed, so the UI must not
                // keep showing a state that was never actually persisted.
                setPreferences((prev) => ({ ...prev, [key]: !nextValue }));
                toast.error("Couldn't update — try again");
            } finally {
                setPendingKey(null);
            }
        },
        [preferences]
    );

    return (
        <div className="min-h-screen bg-[#FFFBF5]">
            <div className="mx-auto max-w-2xl px-4 pb-10 pt-6">
                <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1">
                    <Bell size={11} className="text-orange-500" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-600">
                        Settings
                    </span>
                </div>
                <h1
                    className="text-2xl font-black text-stone-900"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                    Notifications
                </h1>
                <p className="mt-1 text-sm text-stone-500">
                    Choose what you'd like to hear from us. Everything's on by default.
                </p>

                <div className="mt-6 overflow-hidden rounded-2xl border border-stone-100 bg-white">
                    {PREFERENCE_ORDER.map((key, i) => {
                        const Icon = PREFERENCE_ICONS[key];
                        return (
                            <div
                                key={key}
                                className={[
                                    "flex items-center gap-3 px-4 py-3.5",
                                    i !== PREFERENCE_ORDER.length - 1 ? "border-b border-stone-100" : "",
                                ].join(" ")}
                            >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50">
                                    <Icon size={16} className="text-orange-500" strokeWidth={2} />
                                </div>
                                <p className="flex-1 text-[14px] font-semibold text-stone-800">
                                    {NOTIFICATION_PREFERENCE_LABELS[key]}
                                </p>
                                <ToggleSwitch
                                    checked={preferences[key]}
                                    onChange={() => handleToggle(key)}
                                />
                            </div>
                        );
                    })}
                </div>

                <p className="mt-4 text-center text-[11px] text-stone-400">
                    {pendingKey ? "Saving…" : "Changes save automatically"}
                </p>
            </div>
        </div>
    );
}