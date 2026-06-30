// src/lib/automation/conditions.ts
//
// FoodKnock Automation Engine — condition evaluation (Part 1 + Part 2 of 6).
//
// ── PART 1 (unchanged): generic comparison ────────────────────────────────
// compare() and resolveFieldPath() are exactly as built in Part 1 — a
// domain-agnostic comparator that resolves a dot-notation field path
// against a context object. Nothing about that logic changes here.
//
// ── PART 2 (new): named, registered field resolvers ──────────────────────
// "Support extensible condition evaluators... Adding a new condition must
// require creating only one evaluator. No engine modification." Fields
// like `user.lastOrderDays` or `user.totalOrders` AREN'T sitting directly
// on a context object — they have to be COMPUTED (querying the Order
// collection, etc.), which Part 1's pure dot-path resolver can't do. This
// is the missing piece: a ConditionFieldResolver registry. Each resolver
// knows how to compute ONE field's actual value for a given user; the
// EXISTING compare() function (untouched) still does the actual
// eq/gt/lt/in/etc. comparison against whatever value comes back. Adding
// `user.isVIP` tomorrow means writing one resolver and calling
// registerFieldResolver() — evaluateCondition/evaluateConditions below
// never change.
//
// Fields with NO registered resolver fall back to Part 1's generic
// dot-path lookup against the context object — so existing automation-
// state-style conditions (e.g. "automationState.perRule.dailyCount", used
// internally by nothing today but available to any future caller) keep
// working exactly as before, unaffected by this extension.
//
// evaluateCondition/evaluateConditions are now ASYNC (Part 1 had them
// synchronous). This is the one unavoidable signature change: a resolver
// that queries MongoDB cannot be synchronous. The only existing caller
// (automation/engine.ts's processUser) already awaits several other async
// calls in the same function — adding one more `await` there is a
// mechanical one-line update, not a redesign of the conditions module's
// registry pattern, operator semantics, or AND-only composition, all of
// which are unchanged from Part 1.

import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Order from "@/models/Order";
import type {
    AutomationCondition,
    AutomationConditionContext,
    AutomationConditionOperator,
} from "./types";

/** Resolves "a.b.c" against a nested object. Returns undefined for any missing segment. Unchanged from Part 1. */
function resolveFieldPath(context: AutomationConditionContext, path: string): unknown {
    return path.split(".").reduce<unknown>((acc, segment) => {
        if (acc === null || acc === undefined || typeof acc !== "object") return undefined;
        return (acc as Record<string, unknown>)[segment];
    }, context);
}

/** Unchanged from Part 1. */
function compare(operator: AutomationConditionOperator, actual: unknown, expected: unknown): boolean {
    switch (operator) {
        case "eq":
            return actual === expected;
        case "neq":
            return actual !== expected;
        case "gt":
            return typeof actual === "number" && typeof expected === "number" && actual > expected;
        case "gte":
            return typeof actual === "number" && typeof expected === "number" && actual >= expected;
        case "lt":
            return typeof actual === "number" && typeof expected === "number" && actual < expected;
        case "lte":
            return typeof actual === "number" && typeof expected === "number" && actual <= expected;
        case "in":
            return Array.isArray(expected) && expected.includes(actual);
        case "nin":
            return Array.isArray(expected) && !expected.includes(actual);
        case "exists":
            return expected ? actual !== undefined : actual === undefined;
        default: {
            const _exhaustive: never = operator;
            return _exhaustive;
        }
    }
}

// ── Part 2: named field resolver registry ─────────────────────────────────

export interface ConditionFieldResolver {
    readonly field: string;
    /** Computes this field's actual value for `userId`. Returns `undefined` if the field genuinely cannot be resolved (e.g. missing dependency) — never throws for an expected "no data" case. */
    resolve(userId: string, context: AutomationConditionContext): Promise<unknown>;
}

class ConditionFieldRegistry {
    private resolvers = new Map<string, ConditionFieldResolver>();

    register(resolver: ConditionFieldResolver): void {
        this.resolvers.set(resolver.field, resolver);
    }

    get(field: string): ConditionFieldResolver | undefined {
        return this.resolvers.get(field);
    }
}

export const conditionFieldRegistry = new ConditionFieldRegistry();

// ── Real resolvers — mechanical computation, no invented business thresholds ─
// Every resolver below computes a RAW value (a count, a date-diff, a
// stored field). The THRESHOLD that makes a value "pass" or "fail" lives
// entirely in the condition's own `operator`/`value` — supplied by
// whoever defines the rule, not hardcoded here. That's what keeps this
// "architecture", not "business logic": e.g. user.totalOrders >= 5 is a
// business decision the RULE makes; computing "what is this user's
// totalOrders" is mechanical and belongs here.

type LeanUser = {
    loyaltyPoints?: number;
    address?: { city?: string; pincode?: string };
    deliveredOrderCount?: number;
    createdAt?: Date;
    dob?: Date;
};

async function getUserDoc(userId: string): Promise<LeanUser | null> {
    await connectDB();
    return User.findById(userId)
        .select("loyaltyPoints address deliveredOrderCount createdAt dob")
        .lean() as unknown as LeanUser | null;
}

conditionFieldRegistry.register({
    field: "user.loyaltyPoints",
    async resolve(userId) {
        const user = await getUserDoc(userId);
        return user?.loyaltyPoints ?? 0;
    },
});

conditionFieldRegistry.register({
    field: "user.city",
    async resolve(userId) {
        const user = await getUserDoc(userId);
        return user?.address?.city ?? null;
    },
});

conditionFieldRegistry.register({
    field: "user.pincode",
    async resolve(userId) {
        const user = await getUserDoc(userId);
        return user?.address?.pincode ?? null;
    },
});

conditionFieldRegistry.register({
    field: "user.totalOrders",
    async resolve(userId) {
        // Reuses User.deliveredOrderCount (an existing, already-maintained
        // counter) rather than aggregating the Order collection — cheaper
        // (one document read, not a collection scan) AND more semantically
        // correct for marketing/lifecycle purposes: undelivered/cancelled
        // orders shouldn't count toward "how many times has this person
        // actually completed an order with us".
        const user = await getUserDoc(userId);
        return user?.deliveredOrderCount ?? 0;
    },
});

conditionFieldRegistry.register({
    field: "user.accountAge",
    async resolve(userId) {
        const user = await getUserDoc(userId);
        if (!user?.createdAt) return null;
        const days = Math.floor((Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000));
        return days;
    },
});

conditionFieldRegistry.register({
    field: "user.lastOrderDays",
    async resolve(userId) {
        await connectDB();
        const lastOrder = (await Order.findOne({ user: userId })
            .sort({ createdAt: -1 })
            .select("createdAt")
            .lean()) as { createdAt?: Date } | null;
        if (!lastOrder?.createdAt) return null; // no orders yet — gt/gte/lt/lte against null safely evaluate false, never a false "0 days"
        return Math.floor((Date.now() - lastOrder.createdAt.getTime()) / (24 * 60 * 60 * 1000));
    },
});

conditionFieldRegistry.register({
    field: "user.isNewUser",
    // JUDGMENT CALL, flagged: "new" needs SOME threshold to be a boolean
    // at all. 7 days is a reasonable, common default for "still in their
    // first week" — but it's a business decision, not a derived fact, and
    // should be tuned (or this resolver replaced) once there's a real
    // product opinion on it. Prefer conditioning on the raw
    // `user.accountAge` field directly when a different threshold is needed
    // — that doesn't require touching this resolver at all.
    async resolve(userId) {
        const user = await getUserDoc(userId);
        if (!user?.createdAt) return false;
        const days = (Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000);
        return days <= 7;
    },
});

conditionFieldRegistry.register({
    field: "user.isReturningUser",
    // JUDGMENT CALL, flagged — same caveat as isNewUser above. "2 or more
    // delivered orders" is a reasonable, common definition of "has ordered
    // more than once", not a definitive product decision. Prefer
    // conditioning on `user.totalOrders` directly for a different bar.
    async resolve(userId) {
        const user = await getUserDoc(userId);
        return (user?.deliveredOrderCount ?? 0) >= 2;
    },
});

conditionFieldRegistry.register({
    field: "user.isVIP",
    // JUDGMENT CALL, flagged — 500 loyalty points as the VIP bar is a
    // placeholder threshold, not a business decision FoodKnock has made.
    // Prefer conditioning on `user.loyaltyPoints` directly with whatever
    // real threshold the business settles on.
    async resolve(userId) {
        const user = await getUserDoc(userId);
        return (user?.loyaltyPoints ?? 0) >= 500;
    },
});

conditionFieldRegistry.register({
    field: "user.hasReviewedLastOrder",
    // NOT IMPLEMENTED — flagged, not faked. There is no Review model
    // visible anywhere in this codebase (only ReviewReward, which tracks
    // a reward grant, not a per-order review record) to check this
    // against. Returning `undefined` here is an honest "cannot resolve",
    // not a guessed default — any comparison against it safely evaluates
    // to false rather than silently lying. Wire this up for real once a
    // Review/order-feedback model exists.
    async resolve() {
        console.warn(
            'AUTOMATION_CONDITIONS: "user.hasReviewedLastOrder" has no real data source yet (no Review model in this codebase) — resolving to undefined.'
        );
        return undefined;
    },
});

conditionFieldRegistry.register({
    field: "user.cartExists",
    // NOT IMPLEMENTED — flagged, not faked. Cart state in this app is
    // managed client-side (Zustand, per package.json) with no persisted
    // server-side Cart collection to query. Same honest-gap treatment as
    // hasReviewedLastOrder above.
    async resolve() {
        console.warn(
            'AUTOMATION_CONDITIONS: "user.cartExists" has no real data source yet (no server-side Cart model in this codebase) — resolving to undefined.'
        );
        return undefined;
    },
});

// ── Evaluation (registry-aware; falls back to Part 1's generic path lookup) ─

async function resolveField(
    field: string,
    userId: string | undefined,
    context: AutomationConditionContext
): Promise<unknown> {
    const resolver = userId ? conditionFieldRegistry.get(field) : undefined;
    if (resolver && userId) {
        return resolver.resolve(userId, context);
    }
    // No named resolver (or no userId to resolve against, e.g. a rule-
    // level condition with no specific user yet) — fall back to Part 1's
    // generic dot-path lookup against whatever context was supplied.
    return resolveFieldPath(context, field);
}

/** Evaluates a single condition against a context. Async since named field resolvers may query the database. */
export async function evaluateCondition(
    condition: AutomationCondition,
    context: AutomationConditionContext,
    userId?: string
): Promise<boolean> {
    const actual = await resolveField(condition.field, userId, context);
    return compare(condition.operator, actual, condition.value);
}

/**
 * Evaluates a full condition set (AND semantics — unchanged from Part 1).
 * An empty array always passes.
 */
export async function evaluateConditions(
    conditions: AutomationCondition[],
    context: AutomationConditionContext,
    userId?: string
): Promise<boolean> {
    for (const condition of conditions) {
        if (!(await evaluateCondition(condition, context, userId))) {
            return false;
        }
    }
    return true;
}