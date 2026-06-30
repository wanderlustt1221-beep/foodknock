// src/models/LoginAttempt.ts
// Tracks failed login attempts per IP address, independent of any User
// document — this is what powers the IP-based brute-force protection
// (20 failed attempts/hour per IP, then a 1-hour block).
//
// One document per IP, upserted on every failed attempt. A TTL index
// auto-expires stale documents after 3 hours of inactivity (well beyond
// the 1-hour window + 1-hour block), so storage never grows unbounded —
// this is a native MongoDB feature, not an app-level cron job.

import { Schema, model, models } from "mongoose";

const LoginAttemptSchema = new Schema(
    {
        ip: {
            type:     String,
            required: true,
            trim:     true,
        },
        failedCount: {
            type:    Number,
            default: 0,
        },
        windowStart: {
            type:    Date,
            default: null,
        },
        blockedUntil: {
            type:    Date,
            default: null,
        },
        lastAttemptAt: {
            type:    Date,
            default: null,
        },
    },
    { timestamps: true }
);

// ✅ One tracking document per IP.
LoginAttemptSchema.index({ ip: 1 }, { unique: true });

// ✅ Auto-expire stale IP tracking documents after 3 hours of inactivity.
LoginAttemptSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 3 });

const LoginAttempt = models.LoginAttempt || model("LoginAttempt", LoginAttemptSchema);

export default LoginAttempt;