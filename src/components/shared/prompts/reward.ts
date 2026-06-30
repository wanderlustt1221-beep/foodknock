// src/components/shared/prompts/reward.ts
import type { NotificationPromptContent } from "./types";

export const rewardPrompts: NotificationPromptContent[] = [
    { id: "reward_01", mood: "reward", emoji: "💛", title: "Your reward points are waiting", subtitle: "They won't cash themselves in.", ctaLabel: "Cash Them In" },
    { id: "reward_02", mood: "reward", emoji: "🎁", title: "A little surprise might be headed your way", subtitle: "Want to know the moment it arrives?", ctaLabel: "Tell Me First" },
    { id: "reward_03", mood: "reward", emoji: "🍰", title: "Treat-yourself season never ends", subtitle: "We'll remind you when it's time.", ctaLabel: "Remind Me" },
    { id: "reward_04", mood: "reward", emoji: "⭐", title: "Loyalty deserves a little loyalty back", subtitle: "Let's keep each other posted.", ctaLabel: "Deal" },
    { id: "reward_05", mood: "reward", emoji: "🎉", title: "Good news travels fast", subtitle: "Want to be the first to hear it?", ctaLabel: "I'm First" },
    { id: "reward_06", mood: "reward", emoji: "🏅", title: "Your loyalty is paying off", subtitle: "We'll notify you when your rewards are ready.", ctaLabel: "Show My Rewards" },
    { id: "reward_07", mood: "reward", emoji: "💰", title: "Points sitting idle?", subtitle: "Turn them into your next meal — one tap away.", ctaLabel: "Redeem Now" },
    { id: "reward_08", mood: "reward", emoji: "🎀", title: "Exclusive perks, just for you", subtitle: "Regular customers never miss their benefits.", ctaLabel: "Claim Mine" },
    { id: "reward_09", mood: "reward", emoji: "🔓", title: "A reward just unlocked", subtitle: "Check what's yours — before it expires.", ctaLabel: "Unlock Reward" },
    { id: "reward_10", mood: "reward", emoji: "🌈", title: "Every order earns you more", subtitle: "Know exactly when your next reward is ready.", ctaLabel: "Earn More" },
];