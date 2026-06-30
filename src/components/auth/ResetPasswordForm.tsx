"use client";

// src/components/auth/ResetPasswordForm.tsx
// Forgot Password — Step 3: set a new password — FoodKnock
// Mirrors RegisterForm's password field exactly (strength meter, visibility
// toggle) plus a confirm-password field with live match validation.

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Lock, Eye, EyeOff, ArrowRight, Loader2, XCircle, CheckCircle2 } from "lucide-react";
import { getPasswordStrength } from "@/lib/passwordStrength";

type ResetPasswordFormProps = {
    resetToken: string;
    onSuccess: () => void;
};

type FieldErrors = { password?: string; confirmPassword?: string };

export default function ResetPasswordForm({ resetToken, onSuccess }: ResetPasswordFormProps) {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPass, setShowPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

    const strength = getPasswordStrength(password);
    const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

    const validate = (): boolean => {
        const errs: FieldErrors = {};

        if (!password) {
            errs.password = "Password is required.";
        } else if (password.length < 6) {
            errs.password = "Password must be at least 6 characters.";
        }

        if (!confirmPassword) {
            errs.confirmPassword = "Please confirm your password.";
        } else if (password !== confirmPassword) {
            errs.confirmPassword = "Passwords do not match.";
        }

        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);

        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resetToken, password }),
            });
            const data = await res.json();

            if (!res.ok) {
                toast.error(data.message || "Couldn't reset your password. Please start again.", {
                    style: { border: "1.5px solid #fca5a5", borderRadius: "14px", fontWeight: "700", fontSize: "13px" },
                });
                return;
            }

            onSuccess();
        } catch {
            toast.error("Something went wrong. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 pb-1 pt-2 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 shadow-inner">
                    <Lock size={22} className="text-orange-500" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-black text-stone-900">Set a new password</h3>
                <p className="max-w-[320px] text-[13px] leading-relaxed text-stone-500">
                    Choose a strong password you haven&apos;t used before.
                </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">

                {/* New password */}
                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="reset-password"
                        className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-stone-500"
                    >
                        New Password <span className="text-orange-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                        <span className={`pointer-events-none absolute left-3.5 ${fieldErrors.password ? "text-red-400" : "text-stone-400"}`}>
                            <Lock size={14} strokeWidth={2} />
                        </span>
                        <input
                            id="reset-password"
                            type={showPass ? "text" : "password"}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
                            }}
                            placeholder="Create a strong password"
                            autoComplete="new-password"
                            autoFocus
                            aria-invalid={!!fieldErrors.password}
                            aria-describedby={fieldErrors.password ? "reset-password-error" : undefined}
                            className={`w-full rounded-xl border ${fieldErrors.password
                                    ? "border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100"
                                    : "border-amber-200 bg-amber-50/50 focus:border-orange-400 focus:ring-orange-100"
                                } py-2.5 pl-10 pr-10 text-sm font-medium text-stone-800 placeholder:text-stone-400 transition-all focus:bg-white focus:outline-none focus:ring-2`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPass((p) => !p)}
                            aria-label={showPass ? "Hide password" : "Show password"}
                            className="absolute right-3.5 text-stone-400 transition-colors hover:text-orange-500 focus:outline-none"
                        >
                            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                    {password.length > 0 && (
                        <div className="mt-0.5 flex items-center gap-2">
                            <div className="flex flex-1 gap-1">
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= strength.level ? strength.barColorClass : "bg-stone-100"
                                            }`}
                                    />
                                ))}
                            </div>
                            <span className={`text-[10px] font-black ${strength.textColorClass}`}>
                                {strength.label}
                            </span>
                        </div>
                    )}
                    {fieldErrors.password && (
                        <p id="reset-password-error" className="flex items-center gap-1 text-[11px] font-bold text-red-500">
                            <XCircle size={11} className="shrink-0" /> {fieldErrors.password}
                        </p>
                    )}
                </div>

                {/* Confirm password */}
                <div className="flex flex-col gap-1.5">
                    <label
                        htmlFor="reset-confirm-password"
                        className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-stone-500"
                    >
                        Confirm Password <span className="text-orange-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                        <span className={`pointer-events-none absolute left-3.5 ${fieldErrors.confirmPassword ? "text-red-400" : "text-stone-400"}`}>
                            <Lock size={14} strokeWidth={2} />
                        </span>
                        <input
                            id="reset-confirm-password"
                            type={showConfirmPass ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => {
                                setConfirmPassword(e.target.value);
                                if (fieldErrors.confirmPassword) setFieldErrors((f) => ({ ...f, confirmPassword: undefined }));
                            }}
                            placeholder="Re-enter your password"
                            autoComplete="new-password"
                            aria-invalid={!!fieldErrors.confirmPassword}
                            aria-describedby={fieldErrors.confirmPassword ? "reset-confirm-error" : undefined}
                            className={`w-full rounded-xl border ${fieldErrors.confirmPassword
                                    ? "border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100"
                                    : "border-amber-200 bg-amber-50/50 focus:border-orange-400 focus:ring-orange-100"
                                } py-2.5 pl-10 pr-10 text-sm font-medium text-stone-800 placeholder:text-stone-400 transition-all focus:bg-white focus:outline-none focus:ring-2`}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPass((p) => !p)}
                            aria-label={showConfirmPass ? "Hide password" : "Show password"}
                            className="absolute right-3.5 text-stone-400 transition-colors hover:text-orange-500 focus:outline-none"
                        >
                            {showConfirmPass ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                    {passwordsMatch && !fieldErrors.confirmPassword && (
                        <p className="flex items-center gap-1 text-[11px] font-bold text-green-600">
                            <CheckCircle2 size={11} className="shrink-0" /> Passwords match
                        </p>
                    )}
                    {fieldErrors.confirmPassword && (
                        <p id="reset-confirm-error" className="flex items-center gap-1 text-[11px] font-bold text-red-500">
                            <XCircle size={11} className="shrink-0" /> {fieldErrors.confirmPassword}
                        </p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-200/70 transition-all duration-300 hover:brightness-110 hover:shadow-orange-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {loading ? (
                        <><Loader2 size={16} className="animate-spin" /> Resetting password...</>
                    ) : (
                        <>Reset Password <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" /></>
                    )}
                </button>
            </form>
        </div>
    );
}