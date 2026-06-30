"use client";

// src/components/auth/ResetSuccessScreen.tsx
// Forgot Password — Step 4: success — FoodKnock
// - Animated success checkmark
// - Auto-redirects back to the login tab after a short delay
// - Manual "Sign In Now" button for users who don't want to wait

import { useEffect, useState } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";

const AUTO_REDIRECT_SECONDS = 4;

type ResetSuccessScreenProps = {
    onDone: () => void;
};

export default function ResetSuccessScreen({ onDone }: ResetSuccessScreenProps) {
    const [secondsLeft, setSecondsLeft] = useState(AUTO_REDIRECT_SECONDS);

    useEffect(() => {
        if (secondsLeft <= 0) {
            onDone();
            return;
        }
        const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [secondsLeft]);

    return (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div
                className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-100 to-emerald-50 shadow-inner"
                style={{ animation: "resetSuccessPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
            >
                <CheckCircle2 size={40} className="text-green-500" strokeWidth={2} />
                <span
                    className="absolute inset-0 rounded-full border-2 border-green-300"
                    style={{ animation: "resetSuccessRing 1s ease-out" }}
                    aria-hidden="true"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <h3 className="text-lg font-black text-stone-900">Password reset! 🎉</h3>
                <p className="max-w-[300px] text-[13px] leading-relaxed text-stone-500">
                    Your password has been updated successfully. You can now sign in with your new password.
                </p>
            </div>

            <button
                type="button"
                onClick={onDone}
                className="group mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-200/70 transition-all duration-300 hover:brightness-110 hover:shadow-orange-300 active:scale-[0.98]"
            >
                Sign In Now <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" />
            </button>

            <p className="text-[11px] text-stone-400">
                Redirecting to sign in in {secondsLeft}s...
            </p>

            <style jsx global>{`
                @keyframes resetSuccessPop {
                    0%   { transform: scale(0.5); opacity: 0; }
                    100% { transform: scale(1);   opacity: 1; }
                }
                @keyframes resetSuccessRing {
                    0%   { transform: scale(1);   opacity: 0.6; }
                    100% { transform: scale(1.4); opacity: 0; }
                }
            `}</style>
        </div>
    );
}