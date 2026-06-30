// src/components/shared/notificationPromptLibrary.ts
//
// FoodKnock — Notification Prompt Library.
//
// "Every visit should feel fresh... Create a dedicated prompt library...
// Architecture should support hundreds or thousands later." This file is
// exactly that: a plain array of content objects + one selection
// function. Growing the library later is a pure array append — nothing
// here needs to change shape to support that.
//
// `mood` drives a SUBTLE visual variation (icon + accent gradient) on
// the EXISTING premium card shell — never a new illustration asset, per
// "do not redesign the card completely." Every gradient stays anchored
// on the brand's own orange (#FF5C1A) as its first stop, varying only
// the second stop, so moods read as "a shade of FoodKnock", not five
// different brands.

export type PromptMood = "warm" | "playful" | "urgent" | "sweet" | "mysterious";

export type NotificationPromptContent = {
    id: string;
    emoji: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    mood: PromptMood;
};

export const MOOD_GRADIENTS: Record<PromptMood, string> = {
    warm: "linear-gradient(135deg, #FF5C1A 0%, #FFB347 100%)",
    playful: "linear-gradient(135deg, #FF5C1A 0%, #FFD23F 100%)",
    urgent: "linear-gradient(135deg, #FF5C1A 0%, #FF3B30 100%)",
    sweet: "linear-gradient(135deg, #FF5C1A 0%, #FFB6C1 100%)",
    mysterious: "linear-gradient(135deg, #FF5C1A 0%, #92400E 100%)",
};

/** Lucide icon NAME per mood — NotificationPrompt.tsx maps these to the actual imported icon components (keeping this file free of a React/JSX dependency). */
export const MOOD_ICON_NAMES: Record<PromptMood, "Heart" | "Sparkles" | "Flame" | "Gift" | "Eye"> = {
    warm: "Heart",
    playful: "Sparkles",
    urgent: "Flame",
    sweet: "Gift",
    mysterious: "Eye",
};

export const NOTIFICATION_PROMPTS: NotificationPromptContent[] = [
    // ── Warm ───────────────────────────────────────────────────────────────
    { id: "warm_01", mood: "warm", emoji: "🥹", title: "We miss serving you", subtitle: "Come back and let us spoil you a little.", ctaLabel: "Spoil Me" },
    { id: "warm_02", mood: "warm", emoji: "🍲", title: "Comfort food is calling", subtitle: "Let's make your day a little softer.", ctaLabel: "Yes, Please" },
    { id: "warm_03", mood: "warm", emoji: "🫶", title: "You, us, and good food", subtitle: "Just a small ping when it matters most.", ctaLabel: "Keep In Touch" },
    { id: "warm_04", mood: "warm", emoji: "🏡", title: "Home isn't far when food's this good", subtitle: "Stay close, we'll keep you fed.", ctaLabel: "Stay Close" },
    { id: "warm_05", mood: "warm", emoji: "🍪", title: "A small notification for a big craving", subtitle: "Worth it, we promise.", ctaLabel: "Worth It" },

    // ── Playful ──────────────────────────────────────────────────────────
    { id: "playful_01", mood: "playful", emoji: "😂", title: "Your neighbours already know today's offer", subtitle: "Don't be the last one to find out.", ctaLabel: "Tell Me Too" },
    { id: "playful_02", mood: "playful", emoji: "🍔", title: "Food tastes better with notifications ON", subtitle: "Trust the science.", ctaLabel: "I Trust Science" },
    { id: "playful_03", mood: "playful", emoji: "😋", title: "Someone's already ordering your favourite", subtitle: "Are you going to let them win?", ctaLabel: "Not Today" },
    { id: "playful_04", mood: "playful", emoji: "🙈", title: "We promise not to spam you", subtitle: "Just the good stuff. Pinky promise.", ctaLabel: "Pinky Promise" },
    { id: "playful_05", mood: "playful", emoji: "🐱", title: "Curiosity got the cat a discount", subtitle: "Yours is one tap away.", ctaLabel: "I'm Curious" },
    { id: "playful_06", mood: "playful", emoji: "🥤", title: "Thirsty for a deal?", subtitle: "We've got something chilled for you.", ctaLabel: "Pour It In" },
    { id: "playful_07", mood: "playful", emoji: "🧠", title: "Smart eaters get notified first", subtitle: "Be smart.", ctaLabel: "Be Smart" },

    // ── Urgent / FOMO ────────────────────────────────────────────────────
    { id: "urgent_01", mood: "urgent", emoji: "🔥", title: "Secret deal unlocked", subtitle: "But only for the next few minutes.", ctaLabel: "Unlock Now" },
    { id: "urgent_02", mood: "urgent", emoji: "😋", title: "Today's best offers disappear quickly", subtitle: "Don't blink.", ctaLabel: "Don't Blink" },
    { id: "urgent_03", mood: "urgent", emoji: "⏰", title: "The clock's ticking on this one", subtitle: "Notifications are your early warning system.", ctaLabel: "Warn Me" },
    { id: "urgent_04", mood: "urgent", emoji: "🚨", title: "Limited stock alert incoming", subtitle: "Be first, not last.", ctaLabel: "Be First" },
    { id: "urgent_05", mood: "urgent", emoji: "💨", title: "Offers move fast around here", subtitle: "Let us tap your shoulder in time.", ctaLabel: "Tap Me" },

    // ── Sweet / Reward ───────────────────────────────────────────────────
    { id: "sweet_01", mood: "sweet", emoji: "💛", title: "Your reward points are waiting", subtitle: "They won't cash themselves in.", ctaLabel: "Cash Them In" },
    { id: "sweet_02", mood: "sweet", emoji: "🎁", title: "A little surprise might be headed your way", subtitle: "Want to know the moment it arrives?", ctaLabel: "Tell Me First" },
    { id: "sweet_03", mood: "sweet", emoji: "🍰", title: "Treat-yourself season never really ends", subtitle: "We'll remind you when it's time.", ctaLabel: "Remind Me" },
    { id: "sweet_04", mood: "sweet", emoji: "⭐", title: "Loyalty deserves a little loyalty back", subtitle: "Let's keep each other posted.", ctaLabel: "Deal" },
    { id: "sweet_05", mood: "sweet", emoji: "🎉", title: "Good news travels fast", subtitle: "Want to be the first to hear it?", ctaLabel: "I'm First" },

    // ── Mysterious / Curiosity ───────────────────────────────────────────
    { id: "mysterious_01", mood: "mysterious", emoji: "🤫", title: "Don't let discounts escape", subtitle: "This one's between us.", ctaLabel: "Keep My Secret" },
    { id: "mysterious_02", mood: "mysterious", emoji: "🍕", title: "Hungry again?", subtitle: "Someone is already ordering your favourite food...", ctaLabel: "Stop Them" },
    { id: "mysterious_03", mood: "mysterious", emoji: "👀", title: "Something's cooking. Literally.", subtitle: "Want the first look?", ctaLabel: "First Look" },
    { id: "mysterious_04", mood: "mysterious", emoji: "🪄", title: "A little FoodKnock magic awaits", subtitle: "Delivered straight to your screen. Curious?", ctaLabel: "I'm Curious" },
    { id: "mysterious_05", mood: "mysterious", emoji: "🔮", title: "We can predict your next craving", subtitle: "Let us prove it.", ctaLabel: "Prove It" },
    { id: "mysterious_06", mood: "mysterious", emoji: "🌙", title: "Late night cravings need an early warning", subtitle: "Stay in the loop, even at 1am.", ctaLabel: "Stay In The Loop" },
];

const LAST_SHOWN_PROMPT_ID_KEY = "fk_notif_last_prompt_id";

/**
 * Tracks ONLY the single most-recently-shown prompt ID — not a counter,
 * not a schedule, a different and much narrower purpose than the removed
 * visit-tracking mechanism. Deliberately uses localStorage (not
 * sessionStorage) so the "no immediate repeat" guarantee is meaningful
 * ACROSS sessions too: the sheet shows once per visit, so within a
 * single session this would almost never have a second chance to fire —
 * persisting across sessions is what makes "every visit feels fresh"
 * actually true from one visit to the next.
 */
function getLastShownPromptId(): string | null {
    try {
        return localStorage.getItem(LAST_SHOWN_PROMPT_ID_KEY);
    } catch {
        return null;
    }
}

function setLastShownPromptId(id: string): void {
    try {
        localStorage.setItem(LAST_SHOWN_PROMPT_ID_KEY, id);
    } catch {
        // Storage unavailable — the no-repeat guarantee just won't hold
        // this one time; degrades gracefully rather than throwing.
    }
}

/** Picks a random prompt, guaranteed not to be the immediately previous one shown (unless the library only has one entry). */
export function pickRandomPrompt(): NotificationPromptContent {
    const lastId = getLastShownPromptId();
    const candidates = NOTIFICATION_PROMPTS.length > 1
        ? NOTIFICATION_PROMPTS.filter((p) => p.id !== lastId)
        : NOTIFICATION_PROMPTS;

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    setLastShownPromptId(chosen.id);
    return chosen;
}