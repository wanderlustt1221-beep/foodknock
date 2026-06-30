// src/components/notifications/groupNotifications.ts
//
// Pure date-bucketing logic for the Inbox's "Today / Yesterday / Earlier"
// sections. Kept dependency-free and framework-agnostic so it's trivially
// unit-testable on its own, and shared between NotificationCard (which
// needs to know the group to decide whether to show a time-of-day or a
// short date) and NotificationInbox (which needs it to build the sections).

import type { InboxNotificationItem } from "@/lib/notifications/inboxQuery";

export type InboxGroupLabel = "Today" | "Yesterday" | "Earlier";

const GROUP_ORDER: InboxGroupLabel[] = ["Today", "Yesterday", "Earlier"];

export function getGroupLabel(iso: string): InboxGroupLabel {
    const date = new Date(iso);
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    if (date >= startOfToday) return "Today";
    if (date >= startOfYesterday) return "Yesterday";
    return "Earlier";
}

export type InboxGroup = {
    label: InboxGroupLabel;
    items: InboxNotificationItem[];
};

/**
 * Buckets an already-newest-first list into ordered Today/Yesterday/Earlier
 * sections, omitting any section that has no items. Order within each
 * section is preserved exactly as given (the caller's sort order, which is
 * always newest-first from the API/server query).
 */
export function groupNotifications(items: InboxNotificationItem[]): InboxGroup[] {
    const buckets: Record<InboxGroupLabel, InboxNotificationItem[]> = {
        Today: [],
        Yesterday: [],
        Earlier: [],
    };

    for (const item of items) {
        buckets[getGroupLabel(item.createdAt)].push(item);
    }

    return GROUP_ORDER
        .map((label) => ({ label, items: buckets[label] }))
        .filter((group) => group.items.length > 0);
}