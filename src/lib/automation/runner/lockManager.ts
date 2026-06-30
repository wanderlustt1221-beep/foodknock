// src/lib/automation/runner/lockManager.ts
//
// FoodKnock Automation Engine — Lock Manager (Part 4 of 6).
//
// "Prevent duplicate execution. Prevent concurrent execution of same
// rule. Architecture only. Memory lock implementation is acceptable for
// now. Must be replaceable later by Redis." — unlike queue.ts (genuinely
// interface-only, no implementation at all), this module explicitly
// SHOULD have a real, working implementation today — the brief's wording
// for this section is deliberately different from Queue's.
//
// The interface is the contract a future RedisLockManager would
// implement instead — nothing outside this file (triggerExecutor.ts)
// knows or cares that today's implementation is a Map in memory. Swapping
// it later means writing one new class and changing one line at the
// bottom of this file (which singleton gets constructed) — no caller
// anywhere else changes.
//
// ── WHY A TTL, NOT JUST "LOCKED UNTIL RELEASED" ──────────────────────────
// A purely "locked until explicitly released" design has a fatal flaw for
// a process-crash scenario: if the process holding a lock dies mid-
// execution (before its `finally`/release runs), that rule would be
// locked FOREVER — no future execution of it could ever acquire the
// lock again. A bounded TTL means a stale lock self-expires and a later
// attempt can reclaim it. This is a real, necessary safety property for
// an in-memory implementation specifically (an in-memory Map has no
// fencing against the holder process dying outright) — a future Redis
// implementation would likely use the same TTL pattern for the same reason.

export type Lock = {
    key: string;
    /** Unique per acquisition — required to release, so a stale/duplicate release call can never release a DIFFERENT lock someone else has since acquired for the same key. */
    token: string;
    acquiredAt: Date;
    expiresAt: Date;
};

export interface LockManager {
    /** Returns the acquired Lock, or null if `key` is already locked (and not yet stale). */
    acquire(key: string, ttlMs?: number): Promise<Lock | null>;
    /** No-ops (does not throw) if `lock.token` no longer matches what's held — releasing a lock you don't actually hold is a bug in the caller, not something this method should crash over. */
    release(lock: Lock): Promise<void>;
    isLocked(key: string): Promise<boolean>;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes — generous for any single rule's audience processing, short enough that a crash doesn't block a rule for long

function generateToken(): string {
    return crypto.randomUUID();
}

export class InMemoryLockManager implements LockManager {
    private locks = new Map<string, Lock>();

    async acquire(key: string, ttlMs: number = DEFAULT_TTL_MS): Promise<Lock | null> {
        const existing = this.locks.get(key);
        const now = new Date();

        if (existing && existing.expiresAt.getTime() > now.getTime()) {
            return null; // genuinely still locked, not stale
        }

        const lock: Lock = {
            key,
            token: generateToken(),
            acquiredAt: now,
            expiresAt: new Date(now.getTime() + ttlMs),
        };
        this.locks.set(key, lock);
        return lock;
    }

    async release(lock: Lock): Promise<void> {
        const current = this.locks.get(lock.key);
        if (current?.token === lock.token) {
            this.locks.delete(lock.key);
        }
        // Token mismatch (or already gone) — silently no-op. See interface doc.
    }

    async isLocked(key: string): Promise<boolean> {
        const existing = this.locks.get(key);
        if (!existing) return false;
        return existing.expiresAt.getTime() > Date.now();
    }
}

// Singleton — same hot-reload-safe pattern as every other in-memory
// singleton in this module (automationEngine, schedulerRunner, etc.). The
// Map must survive dev-server hot reloads or "concurrent execution
// prevention" would silently stop working every time a file changes.
const globalForLock = globalThis as unknown as {
    __fkLockManager?: LockManager;
};

export const lockManager: LockManager = globalForLock.__fkLockManager ?? new InMemoryLockManager();

if (process.env.NODE_ENV !== "production") {
    globalForLock.__fkLockManager = lockManager;
}