// src/lib/passwordStrength.ts
// Shared password-strength helper for auth forms.
//
// Mirrors the exact thresholds already used inline in RegisterForm.tsx
// (password.length < 6 => Weak, < 10 => Good, else Strong) so the Reset
// Password screen feels consistent with Register — extracted here so the
// new ResetPasswordForm doesn't duplicate the logic, without touching the
// existing, working RegisterForm.tsx.

export type PasswordStrengthLevel = 0 | 1 | 2 | 3;

export type PasswordStrength = {
    level: PasswordStrengthLevel;
    label: "" | "Weak" | "Good" | "Strong";
    barColorClass: "" | "bg-red-400" | "bg-amber-400" | "bg-green-500";
    textColorClass: "" | "text-red-500" | "text-amber-500" | "text-green-600";
};

const LABELS: PasswordStrength["label"][] = ["", "Weak", "Good", "Strong"];
const BAR_COLORS: PasswordStrength["barColorClass"][] = ["", "bg-red-400", "bg-amber-400", "bg-green-500"];
const TEXT_COLORS: PasswordStrength["textColorClass"][] = ["", "text-red-500", "text-amber-500", "text-green-600"];

export function getPasswordStrength(password: string): PasswordStrength {
    const level: PasswordStrengthLevel =
        password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;

    return {
        level,
        label: LABELS[level],
        barColorClass: BAR_COLORS[level],
        textColorClass: TEXT_COLORS[level],
    };
}