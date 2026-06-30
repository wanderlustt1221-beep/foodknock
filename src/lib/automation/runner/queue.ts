// src/lib/automation/runner/queue.ts
//
// FoodKnock Automation Engine — Queue interfaces (Part 4 of 6).
//
// "Architecture only. NO BullMQ. NO Redis. NO RabbitMQ. NO
// implementation. Only interfaces." Note the deliberate contrast with
// lockManager.ts, where an in-memory implementation is explicitly called
// "acceptable for now" — this section's wording has no such exception.
// Accordingly, this file contains ONLY type-level contracts: no class, no
// singleton, nothing a caller could construct or invoke today. There is
// no in-memory reference implementation here, unlike every other
// registry/manager in this codebase (audienceResolverRegistry,
// lockManager, etc.) — that asymmetry is intentional, not an oversight.
//
// A future part wires a real queue (BullMQ, SQS, whatever) by writing a
// class that implements Queue<TriggerRequest> and registering it
// somewhere the Runner can reach — nothing in triggerExecutor.ts,
// manualRunner.ts, or batchRunner.ts depends on this file today, since
// none of them have anything to enqueue yet. This file exists purely so
// that future integration has a contract to implement against, decided
// now rather than improvised later under deadline pressure.

export type QueueJobStatus = "pending" | "processing" | "completed" | "failed";

export type QueueJob<TPayload = unknown> = {
    id: string;
    payload: TPayload;
    status: QueueJobStatus;
    enqueuedAt: Date;
    /** Reserved for future retry-architecture integration — see automation/types.ts's UserExecutionOutcome, which has the same forward-looking fields for the same reason. */
    attempts?: number;
};

/**
 * A generic, transport-agnostic queue contract. Deliberately minimal —
 * just enough surface for "put work in, take work out, know how much is
 * waiting" — since a real implementation (BullMQ, SQS, RabbitMQ, ...)
 * would each have very different additional capabilities, and inventing
 * a lowest-common-denominator API for all of them without a concrete
 * integration target to validate against would be guessing, not
 * architecture.
 */
export interface Queue<TPayload = unknown> {
    enqueue(payload: TPayload): Promise<QueueJob<TPayload>>;
    dequeue(): Promise<QueueJob<TPayload> | null>;
    depth(): Promise<number>;
    ack(jobId: string): Promise<void>;
    /** Architecture-only — see automation/types.ts's retry fields. No implementation anywhere calls this with intent to actually retry yet. */
    nack(jobId: string, reason?: string): Promise<void>;
}