"use client";

// src/components/shared/SplashScreen.tsx
//
// FoodKnock — cinematic startup splash, continuous-motion choreography.
//
// ARCHITECTURE (unchanged): a small, always-mounted client overlay in the
// root layout (same pattern as NotificationPrompt/OfflineOverlay). Zero
// effect on business logic, auth, orders, notifications, routing, offline
// handling, or the service worker. Identical markup on server and first
// client paint — no hydration mismatch.
//
// NO FAKE DELAY (unchanged principle): readiness is still derived only
// from document.readyState/`load` + document.fonts.ready. What changed in
// THIS revision is the choreography DURING the wait: previously almost
// every element was static until a single burst of motion in the final
// ~500ms. Now every element enters on its own overlapping offset starting
// at t=0, and — critically — settles into a CONTINUOUS idle loop
// (breathing, glow pulse, drifting particles, a recurring light sweep)
// rather than going still, so the splash never has a "nothing is moving"
// window even if real readiness takes longer than the entrance sequence.
//
// ── TIMELINE (entrance offsets, all overlapping, nothing waits for
//    anything else to finish before starting) ──────────────────────────
//   0.00s  background veil fades in
//   0.08s  logo fades + scales 0.88 → 1
//   0.20s  soft orange glow appears behind logo
//   0.35s  logo begins continuous breathing loop (overlaps entrance)
//   0.45s  glow's own shadow/bloom softens and enlarges into its pulse loop
//   0.55s  particles begin appearing, staggered
//   0.80s  wordmark + tagline reveal
//   (spinner's rotation has been running since it mounted — by the time
//    it fades in with the text at 0.8s it already reads as "in motion",
//    never a static appearance)
//   1.20s  a second background gradient layer begins a slow alternating
//          shift, adding depth that keeps changing for as long as needed
//   1.40s  a soft diagonal light sweep crosses the logo — and keeps
//          recurring every ~4.5s for as long as the app is still loading,
//          so a longer-than-expected wait never goes visually silent
//
// ── EXIT (triggered by real readiness) ─────────────────────────────────
// A layered dissolve, not a flat fade: content (logo/text/spinner) blurs
// + scales up + fades (~620ms); the bloom simultaneously EXPANDS and
// brightens rather than shrinking (~750ms); the veil fades LAST, after a
// short delay, revealing the home screen — already live underneath —
// through the thinning wash. pointer-events switch to none the instant
// the exit begins, so home is interactive before the animation finishes.
//
// PERFORMANCE: only transform/opacity/filter are ever animated (GPU
// compositable, no layout thrashing). The single `filter: blur()` use is
// time-boxed to the ~620ms exit only, never a continuous idle effect.
//
// REDUCED MOTION: identical visual design; every transform-driven
// animation (breathing, pulsing, drifting, sweeping, blur-dissolve,
// bloom-expand) is replaced with a fast, simple opacity fade.

import { useState, useEffect, useRef } from "react";

type Phase = "active" | "dissolving" | "hidden";

function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(mq.matches);
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);
    return reduced;
}

/** Resolves once the document is fully loaded AND web fonts have settled. */
function waitForAppReady(): Promise<void> {
    return new Promise((resolve) => {
        const fontsReady =
            typeof document !== "undefined" && "fonts" in document
                ? document.fonts.ready.catch(() => undefined)
                : Promise.resolve();

        const domReady =
            typeof document !== "undefined" && document.readyState === "complete"
                ? Promise.resolve()
                : new Promise<void>((res) => {
                      window.addEventListener("load", () => res(), { once: true });
                  });

        Promise.all([domReady, fontsReady]).then(() => resolve());
    });
}

const LOGO_SRC = "/logo/logo.jpg"; // Same asset Navbar.tsx uses.

const VEIL_FADE_MS = 850;
const VEIL_DELAY_MS = 180;
const TOTAL_DISSOLVE_MS = VEIL_DELAY_MS + VEIL_FADE_MS;

export default function SplashScreen() {
    const [phase, setPhase] = useState<Phase>("active");
    const reducedMotion = useReducedMotion();
    const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let cancelled = false;
        waitForAppReady().then(() => {
            if (!cancelled) setPhase("dissolving");
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (phase !== "dissolving") return;
        const totalMs = reducedMotion ? 220 : TOTAL_DISSOLVE_MS;
        unmountTimerRef.current = setTimeout(() => setPhase("hidden"), totalMs);
        return () => {
            if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
        };
    }, [phase, reducedMotion]);

    const dissolving = phase === "dissolving";

    if (phase === "hidden") return null;

    return (
        <div
            aria-hidden={dissolving}
            role={dissolving ? undefined : "status"}
            aria-label={dissolving ? undefined : "FoodKnock is loading"}
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
            style={{
                pointerEvents: dissolving ? "none" : "auto",
                paddingTop: "env(safe-area-inset-top, 0px)",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
                paddingLeft: "env(safe-area-inset-left, 0px)",
                paddingRight: "env(safe-area-inset-right, 0px)",
            }}
        >
            {/* ══ VEIL layer 1 — base wash, appears t=0, dissolves LAST ══ */}
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "radial-gradient(ellipse at 50% 42%, #FFF7ED 0%, #FFFBF5 55%, #FFFFFF 100%)",
                    opacity: dissolving ? 0 : 1,
                    animation: reducedMotion ? "none" : "fkVeilIn 500ms ease-out both",
                    transition: dissolving
                        ? reducedMotion
                            ? "opacity 200ms ease"
                            : `opacity ${VEIL_FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1) ${VEIL_DELAY_MS}ms`
                        : undefined,
                    willChange: "opacity",
                }}
                aria-hidden="true"
            />

            {/* ══ VEIL layer 2 — slow shifting gradient, begins at 1.2s,
                  keeps the background alive for as long as loading takes ══ */}
            {!reducedMotion && (
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(ellipse at 60% 55%, #FFEDD9 0%, transparent 60%)",
                        opacity: dissolving ? 0 : undefined,
                        animation: dissolving
                            ? undefined
                            : "fkBgShift 6.5s ease-in-out 1.2s infinite alternate",
                        transition: dissolving ? "opacity 400ms ease" : undefined,
                        willChange: "opacity, transform",
                    }}
                    aria-hidden="true"
                />
            )}

            {/* ══ Ambient particles — appear staggered from 0.55s, drift continuously ══ */}
            {!reducedMotion && (
                <>
                    <span
                        className="absolute rounded-full"
                        style={{
                            top: "22%",
                            left: "18%",
                            width: 90,
                            height: 90,
                            background: "radial-gradient(circle, #FFD9B3 0%, transparent 70%)",
                            opacity: dissolving ? 0 : undefined,
                            animation: dissolving
                                ? undefined
                                : "fkParticle1 6.5s ease-in-out 0.55s infinite",
                            transition: dissolving ? "opacity 380ms ease" : undefined,
                            willChange: "transform, opacity",
                        }}
                        aria-hidden="true"
                    />
                    <span
                        className="absolute rounded-full"
                        style={{
                            bottom: "20%",
                            right: "16%",
                            width: 110,
                            height: 110,
                            background: "radial-gradient(circle, #FFC98A 0%, transparent 70%)",
                            opacity: dissolving ? 0 : undefined,
                            animation: dissolving
                                ? undefined
                                : "fkParticle2 7.8s ease-in-out 0.62s infinite",
                            transition: dissolving ? "opacity 380ms ease" : undefined,
                            willChange: "transform, opacity",
                        }}
                        aria-hidden="true"
                    />
                    <span
                        className="absolute rounded-full"
                        style={{
                            top: "62%",
                            left: "12%",
                            width: 56,
                            height: 56,
                            background: "radial-gradient(circle, #FFEAD1 0%, transparent 70%)",
                            opacity: dissolving ? 0 : undefined,
                            animation: dissolving
                                ? undefined
                                : "fkParticle3 5.6s ease-in-out 0.7s infinite",
                            transition: dissolving ? "opacity 380ms ease" : undefined,
                            willChange: "transform, opacity",
                        }}
                        aria-hidden="true"
                    />
                </>
            )}

            {/* ══ CONTENT — logo, wordmark, tagline, loader ══ */}
            <div
                className="relative flex flex-col items-center px-6"
                style={{
                    opacity: dissolving ? 0 : 1,
                    filter: dissolving ? "blur(14px)" : "blur(0px)",
                    transform: dissolving ? "scale(1.07) translateY(-4px)" : "scale(1) translateY(0)",
                    transition: reducedMotion
                        ? "opacity 220ms ease"
                        : "opacity 620ms cubic-bezier(0.4, 0, 0.2, 1), filter 620ms cubic-bezier(0.4, 0, 0.2, 1), transform 620ms cubic-bezier(0.4, 0, 0.2, 1)",
                    willChange: dissolving ? "opacity, filter, transform" : undefined,
                }}
            >
                {/* ── Logo + glow + light sweep ── */}
                <div className="relative mb-7 flex h-[108px] w-[108px] items-center justify-center sm:h-[126px] sm:w-[126px]">
                    {/* Glow — appears at 0.2s, softens into a continuous
                        pulse loop starting 0.45s (fully overlapping the
                        logo's own entrance + breathing) */}
                    <span
                        className="absolute inset-0 -m-6 rounded-full"
                        style={{
                            background: "radial-gradient(circle, #FFB347 0%, transparent 72%)",
                            opacity: dissolving ? 0.9 : undefined,
                            transform: dissolving ? "scale(2.4)" : undefined,
                            animation: dissolving
                                ? undefined
                                : reducedMotion
                                ? "fkGlowInReduced 300ms ease-out 0.2s both"
                                : "fkGlowIn 550ms cubic-bezier(0.16, 1, 0.3, 1) 0.2s both, fkGlowPulse 2.6s ease-in-out 0.45s infinite",
                            transition: dissolving
                                ? "transform 750ms cubic-bezier(0.16, 1, 0.3, 1), opacity 750ms cubic-bezier(0.16, 1, 0.3, 1) 280ms"
                                : undefined,
                            willChange: "transform, opacity",
                        }}
                        aria-hidden="true"
                    />

                    {/* Outer wrapper: one-shot entrance (fade + scale 0.88→1) at 0.08s */}
                    <div
                        style={{
                            animation: reducedMotion
                                ? "fkLogoInReduced 320ms ease-out 0.08s both"
                                : "fkLogoIn 620ms cubic-bezier(0.16, 1, 0.3, 1) 0.08s both",
                            willChange: "transform, opacity",
                        }}
                    >
                        {/* Inner wrapper: continuous breathing loop starting
                            0.35s — nested transforms compose naturally with
                            the outer entrance, producing a soft "settle into
                            breathing" feel rather than two competing motions */}
                        <div
                            className="relative flex h-[108px] w-[108px] items-center justify-center overflow-hidden rounded-[28px] sm:h-[126px] sm:w-[126px]"
                            style={{
                                boxShadow:
                                    "0 24px 56px rgba(255,92,26,0.30), 0 2px 8px rgba(120,53,15,0.12), inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -1px 3px rgba(154,52,18,0.15)",
                                animation: reducedMotion
                                    ? "none"
                                    : "fkLogoBreathe 3.4s ease-in-out 0.35s infinite",
                                willChange: reducedMotion ? undefined : "transform",
                            }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={LOGO_SRC}
                                alt="FoodKnock"
                                width={126}
                                height={126}
                                fetchPriority="high"
                                className="h-full w-full object-cover"
                            />
                            <div
                                className="pointer-events-none absolute inset-0"
                                style={{
                                    background:
                                        "linear-gradient(155deg, rgba(255,255,255,0.28) 0%, transparent 40%, rgba(120,53,15,0.06) 100%)",
                                }}
                                aria-hidden="true"
                            />

                            {/* Light sweep — first crosses at 1.4s, then
                                recurs every ~4.5s for as long as the app is
                                still loading, so nothing goes visually
                                silent on a longer-than-expected wait */}
                            {!reducedMotion && (
                                <div
                                    className="pointer-events-none absolute inset-0"
                                    style={{
                                        background:
                                            "linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.55) 50%, transparent 60%)",
                                        transform: "translateX(-140%)",
                                        opacity: dissolving ? 0 : undefined,
                                        animation: dissolving
                                            ? undefined
                                            : "fkLightSweep 4.5s ease-in-out 1.4s infinite",
                                    }}
                                    aria-hidden="true"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Wordmark + tagline — reveal together at 0.8s ── */}
                <h1
                    className="text-[26px] font-black leading-none tracking-tight text-stone-900 sm:text-[30px]"
                    style={{
                        fontFamily: "'Playfair Display', Georgia, serif",
                        animation: reducedMotion
                            ? "fkTextInReduced 300ms ease-out 0.7s both"
                            : "fkTextIn 560ms cubic-bezier(0.16, 1, 0.3, 1) 0.8s both",
                    }}
                >
                    FoodKnock
                </h1>

                <p
                    className="mt-2 text-[11px] font-black uppercase tracking-[0.32em] text-orange-500"
                    style={{
                        animation: reducedMotion
                            ? "fkTextInReduced 300ms ease-out 0.78s both"
                            : "fkTextIn 560ms cubic-bezier(0.16, 1, 0.3, 1) 0.88s both",
                    }}
                >
                    Fresh in Minutes
                </p>

                {/* ── Loading indicator — rotation starts immediately on
                    mount (t=0), so by the time it fades into view at 0.8s
                    it already reads as "in motion", never a static
                    appearance ── */}
                <div
                    className="mt-9 flex items-center justify-center"
                    style={{
                        animation: reducedMotion
                            ? "fkTextInReduced 300ms ease-out 0.82s both"
                            : "fkTextIn 560ms cubic-bezier(0.16, 1, 0.3, 1) 0.95s both",
                    }}
                >
                    <div
                        className="relative h-6 w-6"
                        style={{
                            animation: reducedMotion ? "none" : "fkRingSpin 1.3s linear infinite",
                            opacity: reducedMotion ? 0.7 : 1,
                            willChange: reducedMotion ? undefined : "transform",
                        }}
                    >
                        <div
                            className="h-full w-full rounded-full"
                            style={{
                                background:
                                    "conic-gradient(from 0deg, #FF5C1A 0%, #FFB347 35%, transparent 70%, transparent 100%)",
                                WebkitMask:
                                    "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
                                mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
                            }}
                        />
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes fkVeilIn {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes fkBgShift {
                    from { opacity: 0.25; transform: scale(1); }
                    to   { opacity: 0.55; transform: scale(1.08); }
                }
                @keyframes fkLogoIn {
                    0%   { opacity: 0; transform: scale(0.88) translateY(6px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes fkLogoInReduced {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes fkLogoBreathe {
                    0%, 100% { transform: scale(1) translateY(0); }
                    50%      { transform: scale(1.035) translateY(-3px); }
                }
                @keyframes fkGlowIn {
                    0%   { opacity: 0; transform: scale(0.7); }
                    100% { opacity: 0.5; transform: scale(1); }
                }
                @keyframes fkGlowInReduced {
                    from { opacity: 0; }
                    to   { opacity: 0.5; }
                }
                @keyframes fkGlowPulse {
                    0%, 100% { transform: scale(1);    opacity: 0.45; }
                    50%      { transform: scale(1.14); opacity: 0.68; }
                }
                @keyframes fkLightSweep {
                    0%, 12%  { transform: translateX(-140%); opacity: 0; }
                    18%      { opacity: 0.9; }
                    38%, 100% { transform: translateX(140%); opacity: 0; }
                }
                @keyframes fkTextIn {
                    0%   { opacity: 0; transform: translateY(8px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                @keyframes fkTextInReduced {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes fkRingSpin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
                @keyframes fkParticle1 {
                    0%, 100% { transform: translate(0, 0);      opacity: 0; }
                    8%       { opacity: 0.5; }
                    50%      { transform: translate(10px, -14px); opacity: 0.5; }
                    92%      { opacity: 0.5; }
                }
                @keyframes fkParticle2 {
                    0%, 100% { transform: translate(0, 0);      opacity: 0; }
                    8%       { opacity: 0.4; }
                    50%      { transform: translate(-12px, 10px); opacity: 0.4; }
                    92%      { opacity: 0.4; }
                }
                @keyframes fkParticle3 {
                    0%, 100% { transform: translate(0, 0);     opacity: 0; }
                    8%       { opacity: 0.45; }
                    50%      { transform: translate(8px, 12px); opacity: 0.45; }
                    92%      { opacity: 0.45; }
                }
            `}</style>
        </div>
    );
}