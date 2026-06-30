"use client";

// src/app/admin/notifications/page.tsx
// Admin Notification Studio — Phase 3 (Web Push) + Feature 3 Part 10
// (rich payload: image, category, priority, badge, CTA buttons, live preview).
// Reuses the existing Notification Engine via /api/admin/notifications/broadcast
// and the existing Cloudinary upload endpoint via /api/upload/image — never
// calls web-push or Cloudinary directly.

import { useState, useRef } from "react";
import { toast } from "react-hot-toast";
import {
    Bell, Send, Radio, Link2, Type, MessageSquare, Image as ImageIcon,
    Tag, Flame, Plus, X, Loader2, Upload,
} from "lucide-react";
import NotificationPreview from "@/components/admin/notifications/NotificationPreview";
import { CATEGORY_DISPLAY } from "@/lib/notifications/categoryDisplay";
import type { NotificationCategory, NotificationPriority } from "@/lib/notifications/types";

const URL_PRESETS = ["/menu", "/my-orders", "/loyalty", "/review-rewards"];

const CATEGORY_OPTIONS = Object.keys(CATEGORY_DISPLAY) as NotificationCategory[];
const PRIORITY_OPTIONS: NotificationPriority[] = ["low", "normal", "high", "urgent"];

type SendState = "idle" | "sendingTest" | "sendingBroadcast";
type CtaDraft = { id: string; label: string; url: string };

export default function AdminNotificationsPage() {
    const [title, setTitle] = useState("");
    const [body, setBody]   = useState("");
    const [url, setUrl]     = useState("/menu");
    const [state, setState] = useState<SendState>("idle");
    const [lastResult, setLastResult] = useState<string | null>(null);

    // ── Rich payload fields (Feature 3, Part 10) ──────────────────────────
    const [imageUrl, setImageUrl]   = useState("");
    const [uploading, setUploading] = useState(false);
    const [category, setCategory]   = useState<NotificationCategory | "">("");
    const [priority, setPriority]   = useState<NotificationPriority>("normal");
    const [badgeText, setBadgeText] = useState("");
    const [ctaButtons, setCtaButtons] = useState<CtaDraft[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const valid = title.trim().length > 0 && body.trim().length > 0;

    async function getOwnSubscriptionEndpoint(): Promise<string | null> {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            return sub?.endpoint ?? null;
        } catch {
            return null;
        }
    }

    // ── Cloudinary image upload — reuses the existing /api/upload/image ───
    // endpoint, the same one ProductForm uses, just with folder="foodknock/
    // notifications" so notification images don't mix into the product
    // image folder. No new upload system.
    async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("folder", "foodknock/notifications");

            const res = await fetch("/api/upload/image", { method: "POST", body: formData });
            const data = await res.json();
            if (data.success) {
                setImageUrl(data.url);
            } else {
                toast.error(data.message || "Image upload failed");
            }
        } catch {
            toast.error("Network error during upload");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    function addCtaButton() {
        if (ctaButtons.length >= 3) return; // mirrors OS push's practical action-button limit
        setCtaButtons((prev) => [...prev, { id: `cta_${Date.now()}`, label: "", url: "" }]);
    }

    function updateCtaButton(id: string, field: "label" | "url", value: string) {
        setCtaButtons((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    }

    function removeCtaButton(id: string) {
        setCtaButtons((prev) => prev.filter((c) => c.id !== id));
    }

    function buildRichPayload() {
        const validCtas = ctaButtons.filter((c) => c.label.trim().length > 0);
        return {
            ...(imageUrl ? { imageUrl } : {}),
            ...(category ? { category } : {}),
            priority,
            ...(badgeText.trim() ? { badgeText: badgeText.trim() } : {}),
            ...(validCtas.length > 0
                ? { ctaButtons: validCtas.map((c) => ({ id: c.id, label: c.label.trim(), url: c.url.trim() || undefined })) }
                : {}),
        };
    }

    async function handleTest() {
        if (!valid || state !== "idle") return;

        const endpoint = await getOwnSubscriptionEndpoint();
        if (!endpoint) {
            toast.error("Enable notifications on this browser first.");
            return;
        }

        setState("sendingTest");
        setLastResult(null);
        try {
            const res = await fetch("/api/admin/notifications/broadcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "test", title, body, url, endpoint, ...buildRichPayload() }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Test notification sent to this browser");
                setLastResult(`Test sent — ${data.sent} delivered, ${data.failed} failed`);
            } else {
                toast.error(data.message || "Failed to send test notification");
            }
        } catch {
            toast.error("Network error — try again");
        } finally {
            setState("idle");
        }
    }

    async function handleBroadcast() {
        if (!valid || state !== "idle") return;
        if (!window.confirm("Send this notification to ALL active subscribers? This cannot be undone.")) {
            return;
        }

        setState("sendingBroadcast");
        setLastResult(null);
        try {
            const res = await fetch("/api/admin/notifications/broadcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "broadcast", title, body, url, ...buildRichPayload() }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Broadcast sent to ${data.sent} subscriber${data.sent !== 1 ? "s" : ""}`);
                setLastResult(
                    `Broadcast complete — ${data.sent} sent, ${data.failed} failed, ${data.deactivated} deactivated`
                );
            } else {
                toast.error(data.message || "Failed to send broadcast");
            }
        } catch {
            toast.error("Network error — try again");
        } finally {
            setState("idle");
        }
    }

    return (
        <div className="space-y-6">
            {/* ── Page header ── */}
            <div>
                <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/8 px-3 py-1">
                    <Bell size={11} className="text-amber-400" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                        Notifications
                    </span>
                </div>
                <h1 className="font-serif text-2xl font-bold text-white md:text-3xl">
                    Notification Studio
                </h1>
                <p className="mt-1 text-sm text-stone-600">
                    Compose a rich push notification, preview it, then test or broadcast.
                </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
                {/* ── Compose card ── */}
                <div className="rounded-2xl border border-white/[0.06] bg-[#0d0d14] p-5">
                    <div className="space-y-4">
                        {/* Title */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">
                                <Type size={11} /> Title
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="🔥 Flash Sale — 20% off today!"
                                maxLength={80}
                                className="w-full rounded-xl border border-white/[0.08] bg-[#151520] px-3.5 py-2.5 text-[13px] text-stone-200 outline-none placeholder:text-stone-700 focus:border-amber-500/40"
                            />
                        </div>

                        {/* Message */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">
                                <MessageSquare size={11} /> Message
                            </label>
                            <textarea
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                placeholder="Tell customers what's new..."
                                maxLength={180}
                                rows={3}
                                className="w-full resize-none rounded-xl border border-white/[0.08] bg-[#151520] px-3.5 py-2.5 text-[13px] text-stone-200 outline-none placeholder:text-stone-700 focus:border-amber-500/40"
                            />
                        </div>

                        {/* Deep link URL */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">
                                <Link2 size={11} /> Deep Link URL
                            </label>
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="/menu"
                                className="w-full rounded-xl border border-white/[0.08] bg-[#151520] px-3.5 py-2.5 text-[13px] text-stone-200 outline-none placeholder:text-stone-700 focus:border-amber-500/40"
                            />
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {URL_PRESETS.map((preset) => (
                                    <button
                                        key={preset}
                                        onClick={() => setUrl(preset)}
                                        className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all duration-150 ${
                                            url === preset
                                                ? "border border-amber-500/35 bg-amber-500/15 text-amber-400"
                                                : "border border-white/[0.06] bg-white/[0.02] text-stone-500 hover:border-white/10 hover:text-stone-300"
                                        }`}
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Image upload */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">
                                <ImageIcon size={11} /> Hero Image (optional)
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={handleImageSelect}
                                className="hidden"
                                id="notif-image-upload"
                            />
                            {imageUrl ? (
                                <div className="flex items-center gap-3">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
                                    <button
                                        onClick={() => setImageUrl("")}
                                        className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] font-bold text-stone-400 hover:text-stone-200"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ) : (
                                <label
                                    htmlFor="notif-image-upload"
                                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-[#151520] py-4 text-[12px] font-bold text-stone-500 transition-colors hover:border-amber-500/30 hover:text-amber-400"
                                >
                                    {uploading ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" /> Uploading…
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={14} /> Upload image (food, offer, festival banner)
                                        </>
                                    )}
                                </label>
                            )}
                        </div>

                        {/* Category + Priority */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">
                                    <Tag size={11} /> Category
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value as NotificationCategory | "")}
                                    className="w-full rounded-xl border border-white/[0.08] bg-[#151520] px-3 py-2.5 text-[12px] text-stone-200 outline-none focus:border-amber-500/40"
                                >
                                    <option value="">Default</option>
                                    {CATEGORY_OPTIONS.map((c) => (
                                        <option key={c} value={c}>{CATEGORY_DISPLAY[c].label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">
                                    <Flame size={11} /> Priority
                                </label>
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as NotificationPriority)}
                                    className="w-full rounded-xl border border-white/[0.08] bg-[#151520] px-3 py-2.5 text-[12px] text-stone-200 outline-none focus:border-amber-500/40"
                                >
                                    {PRIORITY_OPTIONS.map((p) => (
                                        <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Badge text */}
                        <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">
                                Offer Badge (optional)
                            </label>
                            <input
                                type="text"
                                value={badgeText}
                                onChange={(e) => setBadgeText(e.target.value)}
                                placeholder="50% OFF, LIMITED TIME, NEW"
                                maxLength={20}
                                className="w-full rounded-xl border border-white/[0.08] bg-[#151520] px-3.5 py-2.5 text-[13px] text-stone-200 outline-none placeholder:text-stone-700 focus:border-amber-500/40"
                            />
                        </div>

                        {/* CTA buttons */}
                        <div>
                            <div className="mb-1.5 flex items-center justify-between">
                                <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">
                                    CTA Buttons (optional, max 3)
                                </label>
                                {ctaButtons.length < 3 && (
                                    <button
                                        onClick={addCtaButton}
                                        className="flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300"
                                    >
                                        <Plus size={12} /> Add
                                    </button>
                                )}
                            </div>
                            <div className="space-y-2">
                                {ctaButtons.map((cta) => (
                                    <div key={cta.id} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={cta.label}
                                            onChange={(e) => updateCtaButton(cta.id, "label", e.target.value)}
                                            placeholder="Order Again"
                                            className="flex-1 rounded-lg border border-white/[0.08] bg-[#151520] px-3 py-2 text-[12px] text-stone-200 outline-none placeholder:text-stone-700 focus:border-amber-500/40"
                                        />
                                        <input
                                            type="text"
                                            value={cta.url}
                                            onChange={(e) => updateCtaButton(cta.id, "url", e.target.value)}
                                            placeholder="/menu (optional)"
                                            className="flex-1 rounded-lg border border-white/[0.08] bg-[#151520] px-3 py-2 text-[12px] text-stone-200 outline-none placeholder:text-stone-700 focus:border-amber-500/40"
                                        />
                                        <button
                                            onClick={() => removeCtaButton(cta.id)}
                                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] text-stone-500 hover:text-rose-400"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── Actions ── */}
                    <div className="mt-5 flex flex-col gap-2.5 border-t border-white/[0.05] pt-5 sm:flex-row">
                        <button
                            onClick={handleTest}
                            disabled={!valid || state !== "idle"}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-[12px] font-black text-sky-400 transition-all duration-200 hover:bg-sky-500/18 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {state === "sendingTest" ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                            ) : (
                                <Send size={13} />
                            )}
                            Send Test (this browser)
                        </button>

                        <button
                            onClick={handleBroadcast}
                            disabled={!valid || state !== "idle"}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/12 px-4 py-2.5 text-[12px] font-black text-orange-400 transition-all duration-200 hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {state === "sendingBroadcast" ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                            ) : (
                                <Radio size={13} />
                            )}
                            Broadcast to All Subscribers
                        </button>
                    </div>

                    {lastResult && (
                        <p className="mt-3 text-center text-[11px] text-stone-600">{lastResult}</p>
                    )}
                </div>

                {/* ── Live preview ── */}
                <div className="lg:sticky lg:top-4 lg:self-start">
                    <NotificationPreview
                        title={title}
                        body={body}
                        imageUrl={imageUrl || undefined}
                        badgeText={badgeText || undefined}
                        category={category || undefined}
                        priority={priority}
                        ctaLabels={ctaButtons.filter((c) => c.label.trim()).map((c) => c.label.trim())}
                    />
                </div>
            </div>
        </div>
    );
}