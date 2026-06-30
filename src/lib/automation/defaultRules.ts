// src/lib/automation/defaultRules.ts
//
// FoodKnock Automation Engine — default rule placeholders (Part 1 + 2 of 6).
//
// Still architecture-only: every rule is `enabled: false`, every
// `libraryCategory` points at content that ALREADY exists in the
// marketing library (no new marketing copy is introduced here), and
// nothing in this file is seeded into the database automatically — there
// is still no API route or admin UI to manage rules through (that's a
// later part). This is a typed reference array demonstrating how the
// FULL breadth of Part 2's audience/condition/frequency/cooldown
// capabilities plug into a real rule shape, one example per scenario
// from the brief's list (Lunch, Dinner, Late Night, Weekend, Inactive
// Users, Birthday, Cart, Review, Referral, Loyalty, Rain, Festival,
// Pizza Friday).
//
// Cart Reminder and Review Reminder deliberately use `audience: { type:
// "explicit_user_ids" }` rather than "cart_users" — there is no
// resolver registered for "cart_users" (no server-side Cart model
// exists; see audienceResolver.ts's header) and no condition resolver
// for hasReviewedLastOrder/cartExists (no Review model exists either).
// Using explicit_user_ids here keeps these two rules genuinely valid and
// executable today, while their TYPE/intent still clearly demonstrates
// the shape a real cart/review rule will take once those data sources
// exist — at which point only the `audience.type` needs to change.

import type { AutomationRuleDefinition } from "./types";

function placeholder(
    overrides: Partial<Omit<AutomationRuleDefinition, "id">> & Pick<AutomationRuleDefinition, "slug" | "name" | "libraryCategory" | "category">
): Omit<AutomationRuleDefinition, "id"> {
    return {
        enabled: false,
        trigger: { type: "manual" },
        conditions: [],
        audience: { type: "all_users" },
        schedule: { type: "manual" },
        priority: "normal",
        maxPerHour: null,
        maxPerDay: 1,
        cooldownHours: 20,
        categoryCooldownHours: null,
        campaignCooldownHours: null,
        categoryMaxPerDay: null,
        campaignMaxPerDay: null,
        maxLifetime: null,
        channels: ["push"],
        activeFrom: null,
        activeUntil: null,
        timezone: "Asia/Kolkata",
        metadata: { placeholder: true },
        ...overrides,
    };
}

export const DEFAULT_RULES: Array<Omit<AutomationRuleDefinition, "id">> = [
    placeholder({
        slug: "lunch-reminder-placeholder",
        name: "Lunch Reminder (placeholder — disabled)",
        category: "lunch_deal",
        libraryCategory: "lunch",
        audience: { type: "all_users" },
    }),

    placeholder({
        slug: "dinner-reminder-placeholder",
        name: "Dinner Reminder (placeholder — disabled)",
        category: "evening_deal",
        libraryCategory: "dinner",
        audience: { type: "all_users" },
    }),

    placeholder({
        slug: "late-night-reminder-placeholder",
        name: "Late Night Reminder (placeholder — disabled)",
        category: "evening_deal",
        libraryCategory: "late_night",
        audience: { type: "all_users" },
        cooldownHours: 18,
    }),

    placeholder({
        slug: "weekend-reminder-placeholder",
        name: "Weekend Reminder (placeholder — disabled)",
        category: "offer",
        libraryCategory: "weekend",
        audience: { type: "all_users" },
        cooldownHours: 48,
    }),

    placeholder({
        slug: "inactive-users-placeholder",
        name: "Inactive Users Win-Back (placeholder — disabled)",
        category: "general",
        libraryCategory: "inactive_user",
        // Demonstrates a real, mechanical, config-parameterized audience —
        // "inactiveDays" is the admin-supplied threshold, not invented here.
        audience: { type: "inactive_users", config: { inactiveDays: 14 } },
        cooldownHours: 7 * 24,
        maxPerDay: 1,
    }),

    placeholder({
        slug: "birthday-reminder-placeholder",
        name: "Birthday Reminder (placeholder — disabled)",
        category: "reward",
        libraryCategory: "birthday",
        audience: { type: "birthday_users" },
        cooldownHours: 24 * 300, // effectively "once a year" — a birthday rule should not refire for months
    }),

    placeholder({
        slug: "cart-reminder-placeholder",
        name: "Abandoned Cart Reminder (placeholder — disabled)",
        category: "offer",
        libraryCategory: "abandoned_cart",
        // No "cart_users" resolver exists yet (no server-side Cart model —
        // see audienceResolver.ts). explicit_user_ids keeps this rule
        // structurally valid and executable today; swap the audience.type
        // to "cart_users" once that data source exists — nothing else
        // about this rule needs to change.
        audience: { type: "explicit_user_ids", config: { userIds: [] } },
        cooldownHours: 6,
    }),

    placeholder({
        slug: "review-reminder-placeholder",
        name: "Review Reminder (placeholder — disabled)",
        category: "general",
        libraryCategory: "review_reminder",
        conditions: [
            // Demonstrates the registry pattern even though this specific
            // field has no real resolver yet (see conditions.ts's honest-
            // gap registration for "user.hasReviewedLastOrder") — adding
            // the real resolver later requires zero changes to this rule.
            { field: "user.hasReviewedLastOrder", operator: "eq", value: false },
        ],
        audience: { type: "explicit_user_ids", config: { userIds: [] } },
        cooldownHours: 24,
    }),

    placeholder({
        slug: "referral-reminder-placeholder",
        name: "Referral Reminder (placeholder — disabled)",
        category: "reward",
        libraryCategory: "referral",
        audience: { type: "all_users" },
        conditions: [{ field: "user.totalOrders", operator: "gte", value: 1 }],
        cooldownHours: 24 * 14,
    }),

    placeholder({
        slug: "loyalty-reminder-placeholder",
        name: "Loyalty Reminder (placeholder — disabled)",
        category: "reward",
        libraryCategory: "loyalty",
        audience: { type: "loyalty_users", config: { minLoyaltyPoints: 1 } },
        cooldownHours: 24 * 7,
    }),

    placeholder({
        slug: "rain-offer-placeholder",
        name: "Rain Offer (placeholder — disabled)",
        category: "offer",
        libraryCategory: "rain",
        audience: { type: "city", config: { city: "" } }, // admin fills in the target city at configuration time
        cooldownHours: 12,
    }),

    placeholder({
        slug: "festival-reminder-placeholder",
        name: "Festival Reminder (placeholder — disabled)",
        category: "festival",
        libraryCategory: "festival_diwali",
        audience: { type: "all_users" },
        priority: "high",
        activeFrom: null,
        activeUntil: null, // a real festival rule sets these to the festival's actual date window
    }),

    placeholder({
        slug: "pizza-friday-placeholder",
        name: "Pizza Friday (placeholder — disabled)",
        category: "offer",
        libraryCategory: "menu_pizza",
        audience: { type: "all_users" },
        cooldownHours: 24 * 6, // weekly cadence
    }),
];