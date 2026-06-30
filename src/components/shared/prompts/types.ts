// src/components/shared/prompts/types.ts
//
// FoodKnock — Shared types for the notification prompt library.
// Kept in a separate file so each mood file can import types without
// circular dependencies, and so the library can scale to 1000+ prompts
// without any type change — just add more entries to any category file.

export type PromptMood =
    | "warm"
    | "playful"
    | "fomo"
    | "luxury"
    | "reward"
    | "lateNight"
    | "festival"
    | "weekend"
    | "relationship"
    | "food";

export type NotificationPromptContent = {
    /** Unique prompt identifier — format: `{mood}_{two-digit-number}` */
    id: string;
    emoji: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    mood: PromptMood;
};

/** Visual accent gradient per mood — first stop is always brand orange. */
export const MOOD_GRADIENTS: Record<PromptMood, string> = {
    warm:         "linear-gradient(135deg, #FF5C1A 0%, #FFB347 100%)",
    playful:      "linear-gradient(135deg, #FF5C1A 0%, #FFD23F 100%)",
    fomo:         "linear-gradient(135deg, #FF5C1A 0%, #FF3B30 100%)",
    luxury:       "linear-gradient(135deg, #FF5C1A 0%, #92400E 100%)",
    reward:       "linear-gradient(135deg, #FF5C1A 0%, #F59E0B 100%)",
    lateNight:    "linear-gradient(135deg, #FF5C1A 0%, #312E81 100%)",
    festival:     "linear-gradient(135deg, #FF5C1A 0%, #DC2626 100%)",
    weekend:      "linear-gradient(135deg, #FF5C1A 0%, #10B981 100%)",
    relationship: "linear-gradient(135deg, #FF5C1A 0%, #EC4899 100%)",
    food:         "linear-gradient(135deg, #FF5C1A 0%, #84CC16 100%)",
};

/** Glow shadow per mood for icon badge — softens the accent tonally. */
export const MOOD_GLOWS: Record<PromptMood, string> = {
    warm:         "0 6px 20px rgba(255,179,71,0.45)",
    playful:      "0 6px 20px rgba(255,210,63,0.45)",
    fomo:         "0 6px 20px rgba(255,59,48,0.5)",
    luxury:       "0 6px 20px rgba(146,64,14,0.5)",
    reward:       "0 6px 20px rgba(245,158,11,0.45)",
    lateNight:    "0 6px 20px rgba(49,46,129,0.6)",
    festival:     "0 6px 20px rgba(220,38,38,0.5)",
    weekend:      "0 6px 20px rgba(16,185,129,0.45)",
    relationship: "0 6px 20px rgba(236,72,153,0.45)",
    food:         "0 6px 20px rgba(132,204,22,0.4)",
};

/** CTA button glow per mood — subtly matches the badge accent. */
export const MOOD_CTA_GLOWS: Record<PromptMood, string> = {
    warm:         "0 8px 24px rgba(255,92,26,0.35)",
    playful:      "0 8px 24px rgba(255,210,63,0.3)",
    fomo:         "0 8px 24px rgba(255,59,48,0.45)",
    luxury:       "0 8px 24px rgba(146,64,14,0.4)",
    reward:       "0 8px 24px rgba(245,158,11,0.35)",
    lateNight:    "0 8px 24px rgba(49,46,129,0.5)",
    festival:     "0 8px 24px rgba(220,38,38,0.4)",
    weekend:      "0 8px 24px rgba(16,185,129,0.35)",
    relationship: "0 8px 24px rgba(236,72,153,0.35)",
    food:         "0 8px 24px rgba(132,204,22,0.3)",
};

/** Lucide icon name per mood. Component maps these to actual imports. */
export const MOOD_ICON_NAMES: Record<PromptMood, "Heart" | "Sparkles" | "Flame" | "Gift" | "Eye" | "Moon" | "Star" | "Sun" | "Users" | "Coffee"> = {
    warm:         "Heart",
    playful:      "Sparkles",
    fomo:         "Flame",
    luxury:       "Star",
    reward:       "Gift",
    lateNight:    "Moon",
    festival:     "Star",
    weekend:      "Sun",
    relationship: "Users",
    food:         "Coffee",
};

/** Social proof line per mood — real, not invented statistics. */
export const MOOD_SOCIAL_PROOF: Record<PromptMood, string> = {
    warm:         "Regular customers never miss what's good.",
    playful:      "Smart eaters already tapped Allow.",
    fomo:         "Early birds always get the better deal.",
    luxury:       "Exclusive picks — only for those who know.",
    reward:       "Loyalty members earn more with every order.",
    lateNight:    "Night owls who stay notified eat better.",
    festival:     "Festival deals go in minutes. Be ready.",
    weekend:      "Weekend regulars never miss the best specials.",
    relationship: "The best meals are shared — and planned ahead.",
    food:         "Fresh drops go fast. First ping wins.",
};