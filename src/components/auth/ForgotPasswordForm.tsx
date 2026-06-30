"use client";

// src/components/auth/ForgotPasswordForm.tsx
// Forgot Password — Step 1: enter email, request OTP — FoodKnock
// Mirrors the existing LoginForm/RegisterForm Field pattern and styling
// exactly, so this feels like a natural extension of the current auth UI.

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Mail, ArrowRight, ArrowLeft, Loader2, XCircle, KeyRound } from "lucide-react";

type ForgotPasswordFormProps = {
    onCodeSent: (email: string) => void;
    onBackToLogin: () => void;
};

export default function ForgotPasswordForm({ onCodeSent, onBackToLogin }: ForgotPasswordFormProps) {
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(false);

    const validate = (): boolean => {
        const trimmed = email.trim();
        if (!trimmed) {
            setError("Email address is required.");
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setError("Please enter a valid email address.");
            return false;
        }
        setError(undefined);
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);

        try {
            const trimmedEmail = email.trim().toLowerCase();
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: trimmedEmail }),
            });
            const data = await res.json();

            if (!res.ok) {
                toast.error(data.message || "Something went wrong. Please try again.", {
                    style: { border: "1.5px solid #fca5a5", borderRadius: "14px", fontWeight: "700", fontSize: "13px" },
                });
                return;
            }

            // The API always returns a generic success response by design
            // (anti-enumeration) — we move forward to the OTP screen
            // regardless of whether the email is actually registered.
            toast.success("Verification code sent! Check your inbox. 📩", {
                duration: 2400,
                style: {
                    background: "#fff", color: "#1c1917",
                    border: "1.5px solid #fed7aa", borderRadius: "16px",
                    fontWeight: "700", fontSize: "13px",
                    boxShadow: "0 8px 24px rgba(249,115,22,0.15)",
                },
                iconTheme: { primary: "#f97316", secondary: "#fff" },
            });

            onCodeSent(trimmedEmail);
        } catch {
            toast.error("Something went wrong. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <button
                type="button"
                onClick={onBackToLogin}
                className="group inline-flex w-fit items-center gap-1.5 text-xs font-bold text-stone-500 transition-colors hover:text-orange-600"
            >
                <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" />
                Back to Sign In
            </button>

            <div className="flex flex-col items-center gap-2 pb-1 pt-2 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 shadow-inner">
                    <KeyRound size={24} className="text-orange-500" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-black text-stone-900">Forgot your password?</h3>
                <p className="max-w-[320px] text-[13px] leading-relaxed text-stone-500">
                    No worries — enter your email and we&apos;ll send you a 6-digit code to reset it.
                </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="forgot-email"
                        className="flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.18em] text-stone-500"
                    >
                        Email Address
                        <span className="text-orange-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                        <span className={`pointer-events-none absolute left-3.5 ${error ? "text-red-400" : "text-stone-400"}`}>
                            <Mail size={15} strokeWidth={2} />
                        </span>
                        <input
                            id="forgot-email"
                            type="email"
                            value={email}
                            onChange={(e) => { setEmail(e.target.value); setError(undefined); }}
                            placeholder="you@example.com"
                            autoComplete="email"
                            autoFocus
                            required
                            aria-invalid={!!error}
                            aria-describedby={error ? "forgot-email-error" : undefined}
                            className={`w-full rounded-xl border ${error
                                    ? "border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100"
                                    : "border-amber-200 bg-amber-50/50 focus:border-orange-400 focus:ring-orange-100"
                                } py-3 pl-10 pr-4 text-sm font-medium text-stone-800 placeholder:text-stone-400 transition-all duration-200 hover:border-amber-300 focus:bg-white focus:outline-none focus:ring-2`}
                        />
                    </div>
                    {error && (
                        <p id="forgot-email-error" className="flex items-center gap-1 text-[11px] font-bold text-red-500">
                            <XCircle size={11} className="shrink-0" />
                            {error}
                        </p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-200/70 transition-all duration-300 hover:brightness-110 hover:shadow-orange-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? (
                        <><Loader2 size={16} className="animate-spin" /> Sending code...</>
                    ) : (
                        <>Send Verification Code <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" /></>
                    )}
                </button>
            </form>
        </div>
    );
}