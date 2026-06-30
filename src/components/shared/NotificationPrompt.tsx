"use client";

// src/components/shared/NotificationPrompt.tsx
// FoodKnock — Premium notification permission bottom sheet.
//
// Behaviour:
//   1. Guests NEVER see this — gated on `isAuthenticated` (server-side in layout.tsx).
//   2. state === "granted"    → never shown again.
//   3. state === "denied"     → shows an emotionally persuasive "you're missing out"
//                               card guiding users to browser settings — never re-requests.
//   4. state === "prompt"     → shown once per browser SESSION; auto-appears after
//                               ~1.5–2 s (no scroll trigger, no visit counting).
//                               Picks a random prompt from the library, guaranteed not
//                               to repeat the previous one or the same mood consecutively.
//   5. Dismissing             → hides for THIS session only. Next session → shows again.
//
// notificationReminder.ts has been REMOVED; notificationPromptSession.ts replaces it.

import { useEffect, useState, useCallback } from "react";
import {
    Bell, BellOff, X,
    Heart, Sparkles, Flame, Gift, Eye,
    Moon, Star, Sun, Users, Coffee,
    Lock, ChevronRight,
} from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
    pickRandomPrompt,
    MOOD_GRADIENTS,
    MOOD_GLOWS,
    MOOD_CTA_GLOWS,
    MOOD_ICON_NAMES,
    MOOD_SOCIAL_PROOF,
} from "./prompts/index";
import type { NotificationPromptContent } from "./prompts/index";
import {
    isEligibleThisSession,
    markShownThisSession,
    markDismissedThisSession,
} from "./notificationPromptSession";

// ── Constants ─────────────────────────────────────────────────────────────

/** Delay before the sheet appears — feels natural, not intrusive. */
const SHOW_DELAY_MS = 1600;

/** Extra brief delay after PWA install event (install itself is engaging). */
const PWA_SHOW_DELAY_MS = 2000;

// ── Icon map — keeps this file free of string→import magic elsewhere ───────

const MOOD_ICON_COMPONENTS = {
    Heart, Sparkles, Flame, Gift, Eye,
    Moon, Star, Sun, Users, Coffee,
} as const;

// ── What users miss when denied — rendered as chips in the denied card ────

const DENIED_MISS_ITEMS = [
    "Today's Offers",
    "Flash Discounts",
    "Order Updates",
    "Reward Alerts",
    "Free Delivery Days",
    "Loyalty Rewards",
    "Review Perks",
];

// ── Props ─────────────────────────────────────────────────────────────────

type Props = {
    /** Computed server-side in layout.tsx — guests are never passed `true`. */
    isAuthenticated: boolean;
};

// ── Component ─────────────────────────────────────────────────────────────

export default function NotificationPrompt({ isAuthenticated }: Props) {
    const { state, subscribing, subscribe } = usePushNotifications();

    const [mounted,   setMounted]   = useState(false);
    const [eligible,  setEligible]  = useState(false);
    const [visible,   setVisible]   = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [success,   setSuccess]   = useState(false);
    const [prompt,    setPrompt]    = useState<NotificationPromptContent | null>(null);

    // ── Mount guard — prevents SSR/hydration mismatch ──────────────────────
    useEffect(() => { setMounted(true); }, []);

    // ── Session eligibility check ──────────────────────────────────────────
    useEffect(() => {
        if (!mounted || !isAuthenticated) return;
        setEligible(isEligibleThisSession());
    }, [mounted, isAuthenticated]);

    // ── Pick prompt once, stably, when entering "prompt" state ────────────
    useEffect(() => {
        if (!mounted || !isAuthenticated || !eligible) return;
        if (state !== "prompt") return;
        if (!prompt) setPrompt(pickRandomPrompt());
    }, [mounted, isAuthenticated, eligible, state, prompt]);

    // ── Auto-show after delay (no scroll gate, no visit counting) ─────────
    useEffect(() => {
        if (!mounted || !isAuthenticated || !eligible) return;
        if (state !== "prompt" && state !== "denied") return;

        let timer: ReturnType<typeof setTimeout>;

        const show = () => {
            if (!visible) {
                timer = setTimeout(() => {
                    setVisible(true);
                    markShownThisSession();
                }, SHOW_DELAY_MS);
            }
        };

        const onPwaInstalled = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                setVisible(true);
                markShownThisSession();
            }, PWA_SHOW_DELAY_MS);
        };

        show();
        window.addEventListener("pwa-installed", onPwaInstalled);

        return () => {
            window.removeEventListener("pwa-installed", onPwaInstalled);
            clearTimeout(timer);
        };
    }, [mounted, isAuthenticated, eligible, state, visible]);

    // ── Handlers ──────────────────────────────────────────────────────────

    const handleDismiss = useCallback(() => {
        setVisible(false);
        setDismissed(true);
        markDismissedThisSession();
    }, []);

    const handleAllow = useCallback(async () => {
        const ok = await subscribe();
        if (ok) {
            setSuccess(true);
            setTimeout(() => setVisible(false), 2800);
        } else {
            handleDismiss();
        }
    }, [subscribe, handleDismiss]);

    // ── Early exits ───────────────────────────────────────────────────────

    if (!isAuthenticated) return null;
    if (!mounted)         return null;
    if (!eligible)        return null;
    if (dismissed)        return null;
    if (!visible)         return null;
    if (state === "unsupported" || state === "granted" || state === "loading" || state === "default") return null;
    if (state === "prompt" && !prompt) return null;

    // ── Derived visual values ─────────────────────────────────────────────

    const isDenied       = state === "denied";
    const MoodIcon       = prompt ? MOOD_ICON_COMPONENTS[MOOD_ICON_NAMES[prompt.mood]] : Bell;
    const accentGradient = prompt ? MOOD_GRADIENTS[prompt.mood]  : MOOD_GRADIENTS.warm;
    const iconGlow       = prompt ? MOOD_GLOWS[prompt.mood]      : MOOD_GLOWS.warm;
    const ctaGlow        = prompt ? MOOD_CTA_GLOWS[prompt.mood]  : MOOD_CTA_GLOWS.warm;
    const socialProof    = prompt ? MOOD_SOCIAL_PROOF[prompt.mood] : "";

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <>
            {/* Backdrop — mobile only */}
            <div
                className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[3px] md:hidden"
                onClick={handleDismiss}
                aria-hidden="true"
            />

            <div
                role="dialog"
                aria-modal="true"
                aria-label="Notification permission"
                className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-3 md:bottom-5 md:left-auto md:right-5 md:max-w-[348px]"
                style={{ animation: "fkSlideUp 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
            >
                <div
                    className="relative overflow-hidden rounded-3xl"
                    style={{
                        background: "linear-gradient(160deg, #161210 0%, #1c1410 100%)",
                        border: "1px solid rgba(255,92,26,0.18)",
                        boxShadow: "0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03) inset",
                    }}
                >
                    {/* Top accent line */}
                    <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-[1px]"
                        style={{ background: `linear-gradient(90deg, transparent, ${isDenied ? "rgba(255,255,255,0.15)" : "rgba(255,140,66,0.55)"} 50%, transparent)` }}
                        aria-hidden="true"
                    />

                    {/* Ambient glow — mood-tinted, subtle pulse */}
                    {!isDenied && (
                        <div
                            className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full blur-3xl"
                            style={{
                                background: `radial-gradient(circle, ${accentGradient.match(/#[0-9A-Fa-f]{6}/g)?.[1] ?? "#FF5C1A"}, transparent 70%)`,
                                opacity: 0.18,
                                animation: "fkGlowPulse 3s ease-in-out infinite",
                            }}
                            aria-hidden="true"
                        />
                    )}

                    {/* Close button */}
                    <button
                        onClick={handleDismiss}
                        aria-label="Dismiss notification prompt"
                        className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-xl text-white/25 transition-all duration-200 hover:bg-white/10 hover:text-white/60"
                        style={{ background: "rgba(255,255,255,0.05)" }}
                    >
                        <X size={14} />
                    </button>

                    <div className="p-5">

                        {/* ── Success state ──────────────────────────────────────── */}
                        {success ? (
                            <div className="flex flex-col items-center py-4 text-center">
                                <div
                                    className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
                                    style={{
                                        background: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
                                        boxShadow: "0 8px 24px rgba(16,185,129,0.4)",
                                        animation: "fkBounceIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
                                    }}
                                >
                                    <Bell size={26} className="text-white" />
                                </div>
                                <p
                                    className="text-[18px] font-black text-white"
                                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                                >
                                    You&apos;re all set! 🎉
                                </p>
                                <p className="mt-1.5 text-[12px] text-white/40">
                                    We&apos;ll notify you about orders, deals, and rewards.
                                </p>
                            </div>

                        /* ── Denied state — emotionally persuasive, never re-requests ── */
                        ) : isDenied ? (
                            <>
                                <div className="flex items-start gap-3.5">
                                    <div
                                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                                        style={{
                                            background: "linear-gradient(135deg, #374151 0%, #6B7280 100%)",
                                            boxShadow: "0 6px 20px rgba(55,65,81,0.4)",
                                        }}
                                    >
                                        <Lock size={22} className="text-white/80" strokeWidth={2} />
                                    </div>
                                    <div className="pt-0.5">
                                        <p
                                            className="text-[16px] font-black leading-tight text-white"
                                            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                                        >
                                            You&apos;re missing out
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-white/40">
                                            Notifications are blocked in your browser
                                        </p>
                                    </div>
                                </div>

                                {/* What they're missing — chip list */}
                                <div className="mt-4 flex flex-wrap gap-1.5">
                                    {DENIED_MISS_ITEMS.map((item) => (
                                        <span
                                            key={item}
                                            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white/60"
                                            style={{
                                                background: "rgba(255,92,26,0.1)",
                                                border: "1px solid rgba(255,92,26,0.2)",
                                            }}
                                        >
                                            <span className="h-1 w-1 rounded-full bg-orange-500/60" />
                                            {item}
                                        </span>
                                    ))}
                                </div>

                                {/* How to fix it */}
                                <div
                                    className="mt-4 rounded-2xl p-3.5"
                                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                                >
                                    <p className="text-[12px] leading-relaxed text-white/55">
                                        Tap the{" "}
                                        <span className="font-semibold text-white/80">🔒 or ⓘ</span>{" "}
                                        icon in your browser&apos;s address bar, open{" "}
                                        <span className="font-semibold text-white/80">Site settings</span>,
                                        and set{" "}
                                        <span className="font-semibold text-white/80">Notifications</span>{" "}
                                        to <span className="font-semibold text-white/80">Allow</span>.
                                    </p>
                                </div>

                                <button
                                    onClick={handleDismiss}
                                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[14px] font-black text-white transition-all active:scale-[0.98]"
                                    style={{
                                        background: "linear-gradient(135deg, #FF5C1A 0%, #FF8C42 100%)",
                                        boxShadow: "0 8px 24px rgba(255,92,26,0.35)",
                                    }}
                                >
                                    Got It
                                    <ChevronRight size={14} strokeWidth={2.5} />
                                </button>
                            </>

                        /* ── Prompt state — randomised content ─────────────────── */
                        ) : prompt && (
                            <>
                                {/* Header: icon badge + title/subtitle */}
                                <div className="flex items-center gap-3.5">
                                    <div
                                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                                        style={{
                                            background: accentGradient,
                                            boxShadow: iconGlow,
                                            animation: "fkIconFloat 4s ease-in-out infinite",
                                        }}
                                    >
                                        <MoodIcon size={22} className="text-white" strokeWidth={2} />
                                    </div>
                                    <div>
                                        <p
                                            className="text-[16px] font-black leading-tight text-white"
                                            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                                        >
                                            {prompt.emoji} {prompt.title}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-white/40">
                                            {prompt.subtitle}
                                        </p>
                                    </div>
                                </div>

                                {/* Social proof */}
                                {socialProof && (
                                    <p className="mt-3.5 text-[11px] text-white/30 italic">
                                        {socialProof}
                                    </p>
                                )}

                                {/* Primary CTA */}
                                <button
                                    onClick={handleAllow}
                                    disabled={subscribing}
                                    className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-[14px] font-black text-white transition-all duration-150 active:scale-[0.97] disabled:opacity-70"
                                    style={{
                                        background: accentGradient,
                                        boxShadow: ctaGlow,
                                    }}
                                >
                                    {subscribing ? (
                                        <>
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                            Setting up…
                                        </>
                                    ) : (
                                        <>
                                            <Bell size={15} strokeWidth={2.5} />
                                            {prompt.ctaLabel}
                                        </>
                                    )}
                                </button>

                                {/* Secondary dismiss */}
                                <button
                                    onClick={handleDismiss}
                                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-white/20 transition-colors hover:text-white/40"
                                >
                                    <BellOff size={10} />
                                    Not right now
                                </button>

                                <p className="mt-2.5 text-center text-[10px] text-white/15">
                                    You can turn notifications off anytime in your browser settings.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Keyframes ── */}
            <style jsx global>{`
                @keyframes fkSlideUp {
                    from { transform: translateY(110%); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
                @keyframes fkGlowPulse {
                    0%, 100% { opacity: 0.18; transform: scale(1);    }
                    50%       { opacity: 0.28; transform: scale(1.12); }
                }
                @keyframes fkIconFloat {
                    0%, 100% { transform: translateY(0);    }
                    50%       { transform: translateY(-3px); }
                }
                @keyframes fkBounceIn {
                    from { transform: scale(0.6); opacity: 0; }
                    to   { transform: scale(1);   opacity: 1; }
                }
                @media (prefers-reduced-motion: reduce) {
                    [style*="fkGlowPulse"],
                    [style*="fkIconFloat"],
                    [style*="fkBounceIn"],
                    [style*="fkSlideUp"] {
                        animation: none !important;
                    }
                }
            `}</style>
        </>
    );
}