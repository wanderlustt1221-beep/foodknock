// src/lib/automation/runner/triggerRegistry.ts
//
// FoodKnock Automation Engine — Trigger Registry (Part 4 of 6).
//
// "Create pluggable trigger registry. Register trigger handlers. Support
// future trigger types. Do NOT hardcode switch statements everywhere."
// Mirrors the EXACT registry pattern already established in Parts 1-3
// (audienceResolverRegistry, schedulerRegistry, contentSelectorRegistry,
// conditionFieldRegistry) — same shape, same reasoning, applied to a new
// axis: not "what triggers THIS RULE" (AutomationTrigger/
// AutomationSchedule, already built in Parts 1-3 and unchanged here) but
// "what INVOKED THE RUNNER right now" — a manual call, a future HTTP
// request, a future queue message. Rule-level trigger config and
// runner-level trigger source are two independent axes, not duplicates
// of each other.
//
// Only "manual" has a real registered handler. "api"/"scheduled"/"queue"
// are valid TriggerSource values (see executionContext.ts) that anything
// could construct a request with today, but calling normalize() for a
// source with no registered handler throws a clear, named error rather
// than silently guessing at a shape — the same honest-gap treatment
// Parts 1-3 used for audience/condition fields with no real data source.

import type { TriggerSource } from "./executionContext";

export type TriggerRequest = {
    ruleSlug: string;
    dryRun?: boolean;
    initiatedBy?: string;
    metadata?: Record<string, unknown>;
};

export interface TriggerHandler {
    readonly source: TriggerSource;
    /**
     * Normalizes whatever raw input this trigger source provides into a
     * common TriggerRequest. For "manual", the raw input is ALREADY a
     * well-typed object (the caller wrote `{ ruleSlug, dryRun }` directly
     * in code) — normalize() is a pass-through/validation step. A future
     * "api" handler would do real work here: parsing an HTTP request
     * body, validating required fields are present, etc.
     */
    normalize(raw: unknown): TriggerRequest;
}

class TriggerRegistry {
    private handlers = new Map<TriggerSource, TriggerHandler>();

    register(handler: TriggerHandler): void {
        this.handlers.set(handler.source, handler);
    }

    get(source: TriggerSource): TriggerHandler | undefined {
        return this.handlers.get(source);
    }

    /** Throws (rather than silently guessing) when no handler is registered for `source` — see file header. */
    normalize(source: TriggerSource, raw: unknown): TriggerRequest {
        const handler = this.handlers.get(source);
        if (!handler) {
            throw new Error(
                `TRIGGER_REGISTRY: no handler registered for trigger source "${source}". Register one via triggerRegistry.register() before using this source.`
            );
        }
        return handler.normalize(raw);
    }
}

export const triggerRegistry = new TriggerRegistry();

/**
 * The one handler registered today. Validates that the minimum required
 * field (ruleSlug) is actually present and well-typed — genuinely useful
 * even for a "trivial" pass-through, since a caller could still pass
 * malformed input by mistake (e.g. forgetting ruleSlug entirely).
 */
class ManualTriggerHandler implements TriggerHandler {
    readonly source: TriggerSource = "manual";

    normalize(raw: unknown): TriggerRequest {
        const input = raw as Partial<TriggerRequest> | null | undefined;
        if (!input || typeof input.ruleSlug !== "string" || !input.ruleSlug.trim()) {
            throw new Error('TRIGGER_REGISTRY: "manual" trigger requires a non-empty ruleSlug.');
        }
        return {
            ruleSlug: input.ruleSlug,
            dryRun: input.dryRun === true,
            initiatedBy: typeof input.initiatedBy === "string" ? input.initiatedBy : undefined,
            metadata: typeof input.metadata === "object" && input.metadata !== null ? input.metadata : {},
        };
    }
}

triggerRegistry.register(new ManualTriggerHandler());