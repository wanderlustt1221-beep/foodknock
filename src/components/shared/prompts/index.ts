// src/components/shared/prompts/index.ts
//
// FoodKnock — Notification Prompt Library Index.
//
// Architecture designed for 1000+ prompts with zero structural change:
// • Each mood lives in its own file (warm.ts, playful.ts, …)
// • Adding prompts = append to the relevant file only
// • This index file: imports, combines, exports, and handles selection
//
// Selection strategy — "intelligent rotation":
//   1. Never repeat the immediately previous prompt ID  (localStorage, cross-session)
//   2. Avoid repeating the same MOOD consecutively         (localStorage, cross-session)
//   3. When all moods have been recently used, reset and go again
//
// Mood history window = number of moods (10), so each mood appears once
// per full rotation before any mood repeats — gives genuine variety across
// ten consecutive sessions, which is far more than most apps ever get.

import { warmPrompts }         from "./warm";
import { playfulPrompts }      from "./playful";
import { fomoPrompts }         from "./fomo";
import { luxuryPrompts }       from "./luxury";
import { rewardPrompts }       from "./reward";
import { lateNightPrompts }    from "./lateNight";
import { festivalPrompts }     from "./festival";
import { weekendPrompts }      from "./weekend";
import { relationshipPrompts } from "./relationship";
import { foodPrompts }         from "./food";

export type { PromptMood, NotificationPromptContent } from "./types";
export {
    MOOD_GRADIENTS,
    MOOD_GLOWS,
    MOOD_CTA_GLOWS,
    MOOD_ICON_NAMES,
    MOOD_SOCIAL_PROOF,
} from "./types";
import type { PromptMood, NotificationPromptContent } from "./types";

// ── Combined library ──────────────────────────────────────────────────────

export const ALL_PROMPTS: NotificationPromptContent[] = [
    ...warmPrompts,
    ...playfulPrompts,
    ...fomoPrompts,
    ...luxuryPrompts,
    ...rewardPrompts,
    ...lateNightPrompts,
    ...festivalPrompts,
    ...weekendPrompts,
    ...relationshipPrompts,
    ...foodPrompts,
];

/** All distinct moods in the library — derived from the data, not hardcoded. */
export const ALL_MOODS: PromptMood[] = [
    ...new Set(ALL_PROMPTS.map((p) => p.mood)),
] as PromptMood[];

// ── Persistence keys ──────────────────────────────────────────────────────

const LAST_PROMPT_ID_KEY  = "fk_notif_last_prompt_id";
const MOOD_HISTORY_KEY    = "fk_notif_mood_history";    // JSON array, capped at ALL_MOODS.length

function lsGet(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* quota / private — degrades gracefully */ }
}

function getLastPromptId(): string | null {
    return lsGet(LAST_PROMPT_ID_KEY);
}
function setLastPromptId(id: string): void {
    lsSet(LAST_PROMPT_ID_KEY, id);
}

function getMoodHistory(): PromptMood[] {
    try {
        const raw = lsGet(MOOD_HISTORY_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}
function appendMoodHistory(mood: PromptMood): void {
    const history = getMoodHistory();
    history.push(mood);
    // Cap at the number of moods — after a full rotation, reset so every
    // mood can appear again without the window growing unboundedly.
    const capped = history.length > ALL_MOODS.length
        ? history.slice(history.length - ALL_MOODS.length)
        : history;
    lsSet(MOOD_HISTORY_KEY, JSON.stringify(capped));
}

// ── Selection algorithm ───────────────────────────────────────────────────

/**
 * Picks a prompt using intelligent rotation:
 * 1. Excludes the last shown prompt ID.
 * 2. Prefers moods not recently shown (based on mood history window).
 * 3. Falls back to any non-repeated prompt if all moods have been seen.
 *
 * Persists both the chosen prompt ID and the mood history for the next call.
 */
export function pickRandomPrompt(): NotificationPromptContent {
    const lastId      = getLastPromptId();
    const moodHistory = getMoodHistory();

    // Determine which moods are "fresh" (not in the recent history window)
    const recentMoods = new Set(moodHistory);
    const freshMoods  = ALL_MOODS.filter((m) => !recentMoods.has(m));

    // Pool A: different ID AND a fresh mood — ideal pick
    const poolA = ALL_PROMPTS.filter(
        (p) => p.id !== lastId && (freshMoods.length === 0 || freshMoods.includes(p.mood))
    );

    // Pool B: different ID, any mood — fallback when all moods recently used
    const poolB = ALL_PROMPTS.filter((p) => p.id !== lastId);

    // Pool C: entire library — last resort (only when library has 1 item)
    const pool = poolA.length > 0 ? poolA : poolB.length > 0 ? poolB : ALL_PROMPTS;

    const chosen = pool[Math.floor(Math.random() * pool.length)];

    setLastPromptId(chosen.id);
    appendMoodHistory(chosen.mood);

    return chosen;
}