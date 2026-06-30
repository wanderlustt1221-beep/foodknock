// src/models/PendingSignup.ts
// Holds registration data + OTP state for an in-progress signup, until the
// user verifies their email. No User document is ever created until
// verify-signup-otp succeeds — this is the staging area for that data.
//
// Mirrors the passwordReset subdocument pattern from User.ts, but lives as
// its own collection rather than embedded, since there is no User document
// to attach to yet.
//
// A TTL index on createdAt auto-expires abandoned signups after 24 hours —
// this is a native MongoDB feature (not an app-level cron job), so it adds
// zero Vercel cost and needs no scheduled task.

import { Schema, model, models } from "mongoose";

const PendingAddressSchema = new Schema(
    {
        line1:    { type: String, trim: true, default: "" },
        line2:    { type: String, trim: true, default: "" },
        city:     { type: String, trim: true, default: "" },
        state:    { type: String, trim: true, default: "" },
        pincode:  { type: String, trim: true, default: "" },
        landmark: { type: String, trim: true, default: "" },
    },
    { _id: false }
);

const PendingSignupSchema = new Schema(
    {
        // ── Registration data (password already hashed before storage) ──
        name: {
            type:     String,
            required: true,
            trim:     true,
        },
        dob: {
            type:     String,
            required: false,
        },
        email: {
            type:      String,
            required:  true,
            lowercase: true,
            trim:      true,
        },
        phone: {
            type:     String,
            required: true,
            trim:     true,
        },
        password: {
            type:     String,
            required: true,
        },
        referralCodeInput: {
            type:      String,
            trim:      true,
            uppercase: true,
            default:   "",
        },
        address: {
            type:    PendingAddressSchema,
            default: () => ({}),
        },

        // ── OTP state (identical shape/semantics to passwordReset) ──────
        otpHash: {
            type:    String,
            default: null,
        },
        otpExpiresAt: {
            type:    Date,
            default: null,
        },
        otpAttempts: {
            type:    Number,
            default: 0,
        },
        lockedUntil: {
            type:    Date,
            default: null,
        },
        requestCount: {
            type:    Number,
            default: 0,
        },
        requestWindowStart: {
            type:    Date,
            default: null,
        },
        lastRequestedAt: {
            type:    Date,
            default: null,
        },
    },
    { timestamps: true }
);

// ✅ One pending signup per email — re-registering with the same email
// upserts (replaces) the previous attempt rather than creating duplicates.
PendingSignupSchema.index({ email: 1 }, { unique: true });

// ✅ Auto-expire abandoned pending signups after 24 hours (native MongoDB
// TTL index — no cron job, no background worker).
PendingSignupSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

const PendingSignup = models.PendingSignup || model("PendingSignup", PendingSignupSchema);

export default PendingSignup;