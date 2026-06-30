// src/components/shared/prompts/fomo.ts
import type { NotificationPromptContent } from "./types";

export const fomoPrompts: NotificationPromptContent[] = [
    { id: "fomo_01", mood: "fomo", emoji: "🔥", title: "Secret deal unlocked", subtitle: "But only for the next few minutes.", ctaLabel: "Unlock Now" },
    { id: "fomo_02", mood: "fomo", emoji: "😋", title: "Today's best offers disappear quickly", subtitle: "Don't blink.", ctaLabel: "Don't Blink" },
    { id: "fomo_03", mood: "fomo", emoji: "⏰", title: "The clock's ticking on this one", subtitle: "Notifications are your early warning system.", ctaLabel: "Warn Me" },
    { id: "fomo_04", mood: "fomo", emoji: "🚨", title: "Limited stock alert incoming", subtitle: "Be first, not last.", ctaLabel: "Be First" },
    { id: "fomo_05", mood: "fomo", emoji: "💨", title: "Offers move fast around here", subtitle: "Let us tap your shoulder in time.", ctaLabel: "Tap Me" },
    { id: "fomo_06", mood: "fomo", emoji: "🎟️", title: "Only a few slots left", subtitle: "Flash offer — gone when it's gone.", ctaLabel: "Reserve Mine" },
    { id: "fomo_07", mood: "fomo", emoji: "📉", title: "Prices just dropped", subtitle: "Someone's already grabbing it. You still here?", ctaLabel: "Grab It Now" },
    { id: "fomo_08", mood: "fomo", emoji: "🏃", title: "They're already at checkout", subtitle: "You need to catch up — notifications help.", ctaLabel: "Catch Up" },
    { id: "fomo_09", mood: "fomo", emoji: "⚡", title: "Flash deal. Right now.", subtitle: "No time to type — tap once and stay ready.", ctaLabel: "Stay Ready" },
    { id: "fomo_10", mood: "fomo", emoji: "🌪️", title: "Deals blow through here", subtitle: "Be the one who catches them first.", ctaLabel: "Catch Them" },
];