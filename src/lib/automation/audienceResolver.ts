// src/lib/automation/audienceResolver.ts
//
// FoodKnock Automation Engine — audience resolution (Part 1 + Part 2 of 6).
//
// ── PART 1 (unchanged): registry mechanism + explicit_user_ids ──────────
// The AudienceResolver interface, the registry class, and
// ExplicitUserIdsResolver are exactly as built in Part 1. Nothing about
// the registry pattern changes here — Part 2 only registers MORE
// resolvers against the same mechanism.
//
// ── PART 2 (new): real, mechanical, config-parameterized resolvers ──────
// "Only implement architecture... business segmentation logic should
// remain pluggable." The way every resolver below stays "architecture,
// not business logic" is that NONE of them hardcode a business threshold
// — every numeric bar (withinDays, minLoyaltyPoints, inactiveDays,
// minOrders) comes from the rule's OWN `audience.config`, supplied by
// whoever defines the rule. The resolver's job is purely mechanical:
// "run this parameterized query." The one exception, called out below at
// "vip_users", is genuinely unavoidable (there's no universal definition
// of "VIP" to parameterize against if no threshold is supplied at all).
//
// "cart_users" and the generic "segment" type are deliberately left
// UNREGISTERED — same honest-gap treatment Part 1 used for "all_users"
// before this part implemented it. cart_users needs a server-side Cart
// collection that doesn't exist in this codebase (cart state here is
// client-side, per package.json's zustand dependency) — registering a
// resolver for it would mean inventing a fake data source, which is
// exactly what "no hacks, no shortcuts" rules out.

import { connectDB } from "@/lib/db";
import User from "@/models/User";
import type { AutomationAudience, AutomationAudienceType } from "./types";

export interface AudienceResolver {
    readonly type: AutomationAudienceType;
    /** Returns the resolved set of user IDs (as strings) for this audience config. */
    resolve(audience: AutomationAudience): Promise<string[]>;
}

class AudienceResolverRegistry {
    private resolvers = new Map<AutomationAudienceType, AudienceResolver>();

    register(resolver: AudienceResolver): void {
        this.resolvers.set(resolver.type, resolver);
    }

    async resolve(audience: AutomationAudience): Promise<string[]> {
        const resolver = this.resolvers.get(audience.type);
        if (!resolver) {
            console.warn(
                `AUTOMATION_AUDIENCE_RESOLVER: no resolver registered for audience type "${audience.type}" — resolving to an empty audience. Expected for "segment"/"cart_users" until a real data source exists for them.`
            );
            return [];
        }
        return resolver.resolve(audience);
    }
}

export const audienceResolverRegistry = new AudienceResolverRegistry();

type LeanUserId = { _id: { toString(): string } };

function toIds(docs: LeanUserId[]): string[] {
    return docs.map((d) => d._id.toString());
}

// ── Part 1: unchanged ──────────────────────────────────────────────────────

class ExplicitUserIdsResolver implements AudienceResolver {
    readonly type: AutomationAudienceType = "explicit_user_ids";

    async resolve(audience: AutomationAudience): Promise<string[]> {
        const ids = audience.config?.userIds;
        if (!Array.isArray(ids)) return [];
        return ids.filter((id): id is string => typeof id === "string");
    }
}

audienceResolverRegistry.register(new ExplicitUserIdsResolver());

// ── Part 2: real, mechanical, config-driven resolvers ─────────────────────

class AllUsersResolver implements AudienceResolver {
    readonly type: AutomationAudienceType = "all_users";

    async resolve(audience: AutomationAudience): Promise<string[]> {
        await connectDB();
        const includeInactive = audience.config?.includeInactive === true;
        const query = includeInactive ? {} : { isActive: true };
        const docs = (await User.find(query).select("_id").lean()) as unknown as LeanUserId[];
        return toIds(docs);
    }
}

class CityResolver implements AudienceResolver {
    readonly type: AutomationAudienceType = "city";

    async resolve(audience: AutomationAudience): Promise<string[]> {
        const city = audience.config?.city;
        if (typeof city !== "string" || !city.trim()) {
            console.warn('AUTOMATION_AUDIENCE_RESOLVER: "city" audience requires config.city — resolving to empty.');
            return [];
        }
        await connectDB();
        const docs = (await User.find({ isActive: true, "address.city": city })
            .select("_id")
            .lean()) as unknown as LeanUserId[];
        return toIds(docs);
    }
}

class PincodeResolver implements AudienceResolver {
    readonly type: AutomationAudienceType = "pincode";

    async resolve(audience: AutomationAudience): Promise<string[]> {
        const pincode = audience.config?.pincode;
        if (typeof pincode !== "string" || !pincode.trim()) {
            console.warn('AUTOMATION_AUDIENCE_RESOLVER: "pincode" audience requires config.pincode — resolving to empty.');
            return [];
        }
        await connectDB();
        const docs = (await User.find({ isActive: true, "address.pincode": pincode })
            .select("_id")
            .lean()) as unknown as LeanUserId[];
        return toIds(docs);
    }
}

class NewUsersResolver implements AudienceResolver {
    readonly type: AutomationAudienceType = "new_users";

    async resolve(audience: AutomationAudience): Promise<string[]> {
        const withinDays = typeof audience.config?.withinDays === "number" ? audience.config.withinDays : 7;
        await connectDB();
        const cutoff = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000);
        const docs = (await User.find({ isActive: true, createdAt: { $gte: cutoff } })
            .select("_id")
            .lean()) as unknown as LeanUserId[];
        return toIds(docs);
    }
}

class ReturningUsersResolver implements AudienceResolver {
    readonly type: AutomationAudienceType = "returning_users";

    async resolve(audience: AutomationAudience): Promise<string[]> {
        const minOrders = typeof audience.config?.minOrders === "number" ? audience.config.minOrders : 2;
        await connectDB();
        // Reuses User.deliveredOrderCount — the same maintained counter
        // the "user.totalOrders" condition resolver uses — rather than
        // aggregating Order, for the same cost/correctness reasons (see
        // conditions.ts's resolver for "user.totalOrders").
        const docs = (await User.find({ isActive: true, deliveredOrderCount: { $gte: minOrders } })
            .select("_id")
            .lean()) as unknown as LeanUserId[];
        return toIds(docs);
    }
}

class VipUsersResolver implements AudienceResolver {
    readonly type: AutomationAudienceType = "vip_users";

    async resolve(audience: AutomationAudience): Promise<string[]> {
        const minLoyaltyPoints = audience.config?.minLoyaltyPoints;
        // No default here, deliberately — unlike new_users/returning_users,
        // "VIP" has no defensible universal definition. Forcing the rule
        // to supply its own threshold is what keeps this "architecture",
        // not an invented business decision baked into the resolver.
        if (typeof minLoyaltyPoints !== "number") {
            console.warn('AUTOMATION_AUDIENCE_RESOLVER: "vip_users" audience requires config.minLoyaltyPoints — resolving to empty.');
            return [];
        }
        await connectDB();
        const docs = (await User.find({ isActive: true, loyaltyPoints: { $gte: minLoyaltyPoints } })
            .select("_id")
            .lean()) as unknown as LeanUserId[];
        return toIds(docs);
    }
}

class LoyaltyUsersResolver implements AudienceResolver {
    readonly type: AutomationAudienceType = "loyalty_users";

    async resolve(audience: AutomationAudience): Promise<string[]> {
        // Default of 1 = "has engaged with loyalty at all", deliberately
        // a much lower bar than vip_users — these represent two distinct
        // segments (broad loyalty-program members vs. a high-value tier),
        // not the same query with a different label.
        const minLoyaltyPoints = typeof audience.config?.minLoyaltyPoints === "number" ? audience.config.minLoyaltyPoints : 1;
        await connectDB();
        const docs = (await User.find({ isActive: true, loyaltyPoints: { $gte: minLoyaltyPoints } })
            .select("_id")
            .lean()) as unknown as LeanUserId[];
        return toIds(docs);
    }
}

class ReferralUsersResolver implements AudienceResolver {
    readonly type: AutomationAudienceType = "referral_users";

    async resolve(audience: AutomationAudience): Promise<string[]> {
        // scope: "referred" (default) = users who signed up via someone
        // else's referral code (referredBy is set — unambiguous from the
        // User schema). scope: "referrer" = users whose referral reward
        // has been granted — flagged as a LOWER-CONFIDENCE interpretation:
        // this assumes referralRewardGranted marks the REFERRER's reward,
        // which is the natural reading of the field but hasn't been
        // confirmed against the actual referral-resolution business logic.
        const scope = audience.config?.scope === "referrer" ? "referrer" : "referred";
        await connectDB();
        const query = scope === "referrer" ? { isActive: true, referralRewardGranted: true } : { isActive: true, referredBy: { $ne: null } };
        const docs = (await User.find(query).select("_id").lean()) as unknown as LeanUserId[];
        return toIds(docs);
    }
}

class InactiveUsersResolver implements AudienceResolver {
    readonly type: AutomationAudienceType = "inactive_users";

    async resolve(audience: AutomationAudience): Promise<string[]> {
        const inactiveDays = typeof audience.config?.inactiveDays === "number" ? audience.config.inactiveDays : 14;
        await connectDB();
        const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

        // "Inactive" = either (a) has ordered before, but not within the
        // window, or (b) has NEVER ordered and signed up before the
        // window too (so a brand-new user isn't immediately "inactive").
        const docs = (await User.aggregate([
            { $match: { isActive: true } },
            {
                $lookup: {
                    from: "orders",
                    let: { userId: "$_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$user", "$$userId"] } } },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                        { $project: { createdAt: 1 } },
                    ],
                    as: "lastOrder",
                },
            },
            {
                $match: {
                    $or: [
                        { lastOrder: { $size: 0 }, createdAt: { $lt: cutoff } },
                        { "lastOrder.0.createdAt": { $lt: cutoff } },
                    ],
                },
            },
            { $project: { _id: 1 } },
        ])) as unknown as LeanUserId[];

        return toIds(docs);
    }
}

class BirthdayUsersResolver implements AudienceResolver {
    readonly type: AutomationAudienceType = "birthday_users";

    async resolve(audience: AutomationAudience): Promise<string[]> {
        const daysAhead = typeof audience.config?.daysAhead === "number" ? audience.config.daysAhead : 0;
        await connectDB();

        const target = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
        const targetMonth = target.getMonth() + 1; // Mongo's $month is 1-indexed
        const targetDay = target.getDate();

        const docs = (await User.aggregate([
            { $match: { isActive: true, dob: { $exists: true, $ne: null } } },
            { $addFields: { dobMonth: { $month: "$dob" }, dobDay: { $dayOfMonth: "$dob" } } },
            { $match: { dobMonth: targetMonth, dobDay: targetDay } },
            { $project: { _id: 1 } },
        ])) as unknown as LeanUserId[];

        return toIds(docs);
    }
}

audienceResolverRegistry.register(new AllUsersResolver());
audienceResolverRegistry.register(new CityResolver());
audienceResolverRegistry.register(new PincodeResolver());
audienceResolverRegistry.register(new NewUsersResolver());
audienceResolverRegistry.register(new ReturningUsersResolver());
audienceResolverRegistry.register(new VipUsersResolver());
audienceResolverRegistry.register(new LoyaltyUsersResolver());
audienceResolverRegistry.register(new ReferralUsersResolver());
audienceResolverRegistry.register(new InactiveUsersResolver());
audienceResolverRegistry.register(new BirthdayUsersResolver());

// "segment" (generic/future) and "cart_users" (no data source — see file
// header) deliberately have NO resolver registered, same honest-gap
// treatment as Part 1's original "all_users" before this part existed.

/** Convenience passthrough so callers only need one import — mirrors notificationEngine's own emit()/send() passthrough pattern. */
export async function resolveAudience(audience: AutomationAudience): Promise<string[]> {
    return audienceResolverRegistry.resolve(audience);
}