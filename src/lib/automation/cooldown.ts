// src/lib/automation/cooldown.ts
//
// FoodKnock Automation Engine — cooldown gate (Part 1 of 6).
//
// Answers exactly one question: "has rule.cooldownHours elapsed since
// this rule last fired for this user?" Read-only — this module never
// writes to AutomationUserState. Recording that a send happened (and
// thus updating lastSentAt) is engine.ts's job, done once, after a send
// actually succeeds — see engine.ts's recordExecutionForUser. Keeping the
// read and write sides separate means this module has exactly one
// responsibility and can be tested/replaced independently of how state
// gets written.

import type { AutomationGateResult } from "./types";

export type PerRuleCooldownState = {
    lastSentAt: Date | null;
};

/**
 * `perRuleState` is whatever's stored at AutomationUserState.perRule[ruleSlug]
 * for this user — undefined if the rule has never fired for them before,
 * which always passes (nothing to cool down from yet).
 */
export function checkCooldown(
    cooldownHours: number,
    perRuleState: PerRuleCooldownState | undefined,
    now: Date = new Date()
): AutomationGateResult {
    if (!perRuleState?.lastSentAt) {
        return { allowed: true };
    }

    if (cooldownHours <= 0) {
        return { allowed: true };
    }

    const elapsedMs = now.getTime() - perRuleState.lastSentAt.getTime();
    const cooldownMs = cooldownHours * 60 * 60 * 1000;

    if (elapsedMs >= cooldownMs) {
        return { allowed: true };
    }

    const remainingHours = Math.ceil((cooldownMs - elapsedMs) / (60 * 60 * 1000));
    return {
        allowed: false,
        reason: `Cooldown active — ${remainingHours}h remaining since last send.`,
    };
}

// ── Part 2: multi-dimensional cooldown ────────────────────────────────────
//
// "Rule Cooldown, Category Cooldown, Campaign Cooldown, Future Global
// Cooldown" — each dimension is a (cooldownHours, state) pair checked via
// the EXACT SAME checkCooldown() above, the same composition pattern
// frequencyLimiter.ts uses for its own dimensions. A category cooldown
// means "has ANY rule sent this category to this user recently enough to
// matter" — independent of which specific rule sent it, which is exactly
// why this reads from AutomationUserState.perCategory rather than perRule.

export type CooldownDimension = {
    name: "rule" | "category" | "campaign" | "global";
    cooldownHours: number | null;
    state: PerRuleCooldownState | undefined;
};

export function checkAllCooldowns(
    dimensions: CooldownDimension[],
    now: Date = new Date()
): AutomationGateResult {
    for (const dimension of dimensions) {
        if (dimension.cooldownHours === null) continue; // not enforced for this dimension
        const result = checkCooldown(dimension.cooldownHours, dimension.state, now);
        if (!result.allowed) {
            return { allowed: false, reason: `[${dimension.name}] ${result.reason}` };
        }
    }
    return { allowed: true };
}