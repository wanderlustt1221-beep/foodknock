// src/lib/automation/api/helpers.ts
//
// FoodKnock Automation Engine — API helpers (Part 6 of 6).
//
// "Reuse existing execution history. Do NOT invent duplicate tracking."
// This is that reuse: NotificationLog (Feature 1, completely untouched)
// already records, per recipient, exactly what retry.ts needs —
// `campaignId` (set to the rule's slug by the existing marketing
// rotation system, indexed) and `status` ("sent"|"failed"|"partial"|
// "skipped", from the existing DeliveryResult), plus an indexed
// `createdAt`. A past execution's specific failures are findable by
// querying that, bounded by the execution's own startedAt/finishedAt —
// no new per-user tracking model was created for this.

import { connectDB } from "@/lib/db";
import NotificationLog from "@/models/NotificationLog";

type LeanUserId = { user: { toString(): string } | null };

/**
 * Finds the distinct user IDs whose delivery genuinely FAILED (status
 * "failed" or "partial" — NOT "skipped", which represents a deliberate,
 * correct preference-gate decision, never something to retry) for
 * `ruleSlug`, within the time window of one specific past execution.
 *
 * The (campaignId, time-window) combination is what scopes this to ONE
 * execution rather than the rule's entire history — not a perfect
 * substitute for a direct executionId reference (NotificationLog has no
 * such field, and adding one would mean touching Feature 1's schema,
 * which this part deliberately avoids — see retry.ts's header), but
 * accurate for the common case Part 5's window-claiming already
 * guarantees: a scheduled rule's executions never have overlapping time
 * windows. Manual/retry runs theoretically could overlap if triggered
 * in rapid succession — a known, narrow edge case, not silently ignored.
 */
export async function findFailedUserIdsForExecution(
    ruleSlug: string,
    startedAt: Date,
    finishedAt: Date
): Promise<string[]> {
    await connectDB();

    const docs = (await NotificationLog.find({
        campaignId: ruleSlug,
        createdAt: { $gte: startedAt, $lte: finishedAt },
        status: { $in: ["failed", "partial"] },
        user: { $ne: null },
    })
        .select("user")
        .lean()) as unknown as LeanUserId[];

    const userIds = new Set<string>();
    for (const doc of docs) {
        if (doc.user) userIds.add(doc.user.toString());
    }

    return Array.from(userIds);
}