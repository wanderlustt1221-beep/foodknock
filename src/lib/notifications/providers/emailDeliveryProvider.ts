// src/lib/notifications/providers/emailDeliveryProvider.ts
// FoodKnock Notification Engine — Email delivery provider.
//
// This provider does NOT send email itself. It is a thin adapter that
// resolves a NotificationPayload into a call against the EXISTING,
// already-working functions in src/lib/mailer.ts (sendOtpEmail,
// sendSignupOtpEmail, sendWelcomeEmail, sendOrderDeliveredEmail, plus the
// two new pass-throughs added below for loyalty/referral). No SMTP logic,
// no transporter, no template HTML lives here or is duplicated here — all
// of that remains exactly where it already is, in mailer.ts and
// src/lib/emailTemplates/*.
//
// Why dispatch on `payload.data.kind` instead of `payload.title`/`body`:
// the generic NotificationPayload (title/body/url) is shaped for push
// notifications. Existing mail functions need their own typed data
// (otp, orderId, customerName, etc.) that has no equivalent push field.
// Templates that support email put that data on `payload.data` alongside
// the push-shaped fields — this provider reads `data`, the WebPushProvider
// reads title/body/url/actions; each provider takes only the slice it
// understands from the same shared payload. See transactionalTemplates.ts
// and templates.ts for where `data.kind` is set.

import { connectDB } from "@/lib/db";
import User from "@/models/User";
import {
    sendOtpEmail,
    sendSignupOtpEmail,
    sendWelcomeEmail,
    sendOrderDeliveredEmail,
} from "@/lib/mailer";
import type {
    DeliveryProvider,
    DeliveryResult,
    NotificationPayload,
    NotificationTarget,
} from "../types";

// ── Email-specific payload data shapes ───────────────────────────────────
// These mirror the exact parameter shapes the existing mailer.ts functions
// already require — defined here (not duplicated as new mailer types)
// purely so this provider can validate event.data narrowly per kind.

type OtpRequestedData = {
    kind: "auth.otp_requested";
    /** Distinguishes which existing OTP email to send — they are different emails. */
    flow: "reset" | "signup";
    otp: string;
};

type PasswordResetData = {
    kind: "auth.password_reset";
    // Reserved for a future confirmation-style email (e.g. "your password
    // was changed"). No existing mailer.ts function sends this today —
    // see notes at bottom of file. Declared now so the event name and
    // provider switch are already correct when that template is added.
};

type WelcomeData = {
    kind: "user.welcome";
};

type OrderDeliveredData = {
    kind: "order.delivered";
    orderId: string;
    customerName?: string;
};

type LoyaltyPointsCreditedData = {
    kind: "loyalty.points_credited";
    // Reserved — no existing loyalty email template in mailer.ts today.
    // See notes at bottom of file.
};

type ReferralRewardGrantedData = {
    kind: "referral.reward_granted";
    // Reserved — no existing referral email template in mailer.ts today.
    // See notes at bottom of file.
};

type EmailPayloadData =
    | OtpRequestedData
    | PasswordResetData
    | WelcomeData
    | OrderDeliveredData
    | LoyaltyPointsCreditedData
    | ReferralRewardGrantedData;

function isEmailPayloadData(data: unknown): data is EmailPayloadData {
    return !!data && typeof data === "object" && "kind" in data;
}

// ── User → email resolution ───────────────────────────────────────────────
// Mirrors the same lookup pattern already used in createOrderCore.ts and
// the orders [id] route (User.findById(...).select("email name").lean()) —
// not a new pattern, just applied here since target.userId is the only
// addressing the engine's NotificationTarget gives this provider; the
// existing mail functions all take a raw email string.
async function resolveUserContact(
    userId: string
): Promise<{ email: string; name: string } | null> {
    await connectDB();
    const user = await User.findById(userId)
        .select("email name")
        .lean() as { email?: string; name?: string } | null;

    if (!user?.email) return null;
    return { email: user.email, name: user.name ?? "" };
}

export class EmailDeliveryProvider implements DeliveryProvider {
    readonly channel = "email" as const;

    async send(target: NotificationTarget, payload: NotificationPayload): Promise<DeliveryResult> {
        const empty: DeliveryResult = { channel: "email", sent: 0, failed: 0, deactivated: 0 };

        if (!isEmailPayloadData(payload.data)) {
            console.error(
                "EMAIL_PROVIDER_ERROR: payload.data is missing or has no `kind` — no email template knows how to render this payload. " +
                "Every event routed to the email channel must include a typed `data.kind` (see transactionalTemplates.ts / templates.ts)."
            );
            return { ...empty, failed: 1 };
        }

        // Email is always user-addressed today — broadcast/subscriptionIds
        // targeting (push-specific concepts) have no email equivalent here.
        if (!target.userId) {
            console.error(
                `EMAIL_PROVIDER_ERROR: event "${payload.data.kind}" has no target.userId — email delivery requires a specific user.`
            );
            return { ...empty, failed: 1 };
        }

        const contact = await resolveUserContact(target.userId);
        if (!contact) {
            console.error(
                `EMAIL_PROVIDER_ERROR: no email on file for user ${target.userId} — skipping "${payload.data.kind}".`
            );
            return { ...empty, failed: 1 };
        }

        try {
            switch (payload.data.kind) {
                case "auth.otp_requested": {
                    const { flow, otp } = payload.data;
                    if (flow === "signup") {
                        await sendSignupOtpEmail({ to: contact.email, name: contact.name, otp });
                    } else {
                        await sendOtpEmail({ to: contact.email, name: contact.name, otp });
                    }
                    return { ...empty, sent: 1 };
                }

                case "user.welcome": {
                    await sendWelcomeEmail(contact.email, { name: contact.name });
                    return { ...empty, sent: 1 };
                }

                case "order.delivered": {
                    const { orderId, customerName } = payload.data;
                    await sendOrderDeliveredEmail(contact.email, {
                        customerName: customerName || contact.name,
                        orderId,
                    });
                    return { ...empty, sent: 1 };
                }

                case "auth.password_reset":
                case "loyalty.points_credited":
                case "referral.reward_granted":
                    // No existing mailer.ts function covers these yet (see
                    // file header). Logged, not silently dropped, so a gap
                    // is visible rather than appearing as a successful send.
                    console.warn(
                        `EMAIL_PROVIDER_SKIPPED: "${payload.data.kind}" has no corresponding function in mailer.ts yet — add one there, then add a case here. Not sent.`
                    );
                    return empty;

                default: {
                    const _exhaustive: never = payload.data;
                    return _exhaustive;
                }
            }
        } catch (err) {
            console.error(`EMAIL_PROVIDER_SEND_ERROR (${payload.data.kind}):`, err);
            return { ...empty, failed: 1 };
        }
    }
}

export const emailDeliveryProvider = new EmailDeliveryProvider();

// ─────────────────────────────────────────────────────────────────────────
// NOTES — events declared in NotificationEventName with no email template
// wired through yet:
//
//   auth.password_reset      — no "password changed" confirmation email
//                               exists in mailer.ts today; the OTP itself
//                               is sent via auth.otp_requested (flow:"reset").
//   loyalty.points_credited  — no loyalty email template exists yet.
//   referral.reward_granted  — no referral email template exists yet.
//
// Per the reuse policy, this provider does not invent new templates for
// these — that would duplicate/guess at content that doesn't exist yet.
// When those templates are added to mailer.ts + emailTemplates/, add the
// corresponding case above; no other file needs to change.
// ─────────────────────────────────────────────────────────────────────────