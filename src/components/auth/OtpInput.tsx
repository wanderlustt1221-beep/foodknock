"use client";

// src/components/auth/OtpInput.tsx
// Reusable 6-digit OTP input — FoodKnock
// - Auto-focus first box on mount
// - Auto-advance to next box on digit entry
// - Auto-backspace navigation to previous box
// - Full paste support (pasting "123456" fills all boxes)
// - Arrow-key navigation between boxes
// - Mobile-friendly numeric keypad (inputMode="numeric")

import { useRef, useEffect, useCallback } from "react";

type OtpInputProps = {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    error?: boolean;
    autoFocus?: boolean;
};

export default function OtpInput({
    length = 6,
    value,
    onChange,
    disabled,
    error,
    autoFocus = true,
}: OtpInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const digits = Array.from({ length }, (_, i) => value[i] ?? "");

    useEffect(() => {
        if (autoFocus) {
            inputRefs.current[0]?.focus();
        }
        // Only run on mount — re-focusing on every value change would steal
        // focus away from wherever the user currently is.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setDigitAt = useCallback(
        (index: number, digit: string) => {
            const next = digits.slice();
            next[index] = digit;
            onChange(next.join("").slice(0, length));
        },
        [digits, length, onChange]
    );

    const handleChange = (index: number, raw: string) => {
        const sanitized = raw.replace(/\D/g, "");

        if (!sanitized) {
            setDigitAt(index, "");
            return;
        }

        // If the browser/OS autofill or a fast typist delivers multiple
        // digits into a single box, spread them starting at this index.
        if (sanitized.length > 1) {
            const next = digits.slice();
            for (let i = 0; i < sanitized.length && index + i < length; i++) {
                next[index + i] = sanitized[i];
            }
            onChange(next.join("").slice(0, length));
            const nextIndex = Math.min(index + sanitized.length, length - 1);
            inputRefs.current[nextIndex]?.focus();
            return;
        }

        setDigitAt(index, sanitized);
        if (index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
            if (digits[index]) {
                // Let the default change handler clear this box first.
                return;
            }
            // Empty box + backspace -> move back and clear the previous box.
            if (index > 0) {
                e.preventDefault();
                setDigitAt(index - 1, "");
                inputRefs.current[index - 1]?.focus();
            }
            return;
        }

        if (e.key === "ArrowLeft" && index > 0) {
            e.preventDefault();
            inputRefs.current[index - 1]?.focus();
        }

        if (e.key === "ArrowRight" && index < length - 1) {
            e.preventDefault();
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
        if (!pasted) return;
        onChange(pasted);
        const lastIndex = Math.min(pasted.length, length - 1);
        inputRefs.current[lastIndex]?.focus();
    };

    return (
        <div
            className="flex justify-center gap-2 sm:gap-3"
            role="group"
            aria-label={`${length}-digit verification code`}
        >
            {digits.map((digit, index) => (
                <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    pattern="\d*"
                    maxLength={1}
                    value={digit}
                    disabled={disabled}
                    aria-label={`Digit ${index + 1} of ${length}`}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    onFocus={(e) => e.target.select()}
                    className={`h-12 w-10 rounded-xl border text-center text-lg font-black text-stone-800 transition-all duration-200 sm:h-14 sm:w-12 ${error
                            ? "border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100"
                            : "border-amber-200 bg-amber-50/50 focus:border-orange-400 focus:ring-orange-100"
                        } hover:border-amber-300 focus:bg-white focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60`}
                />
            ))}
        </div>
    );
}