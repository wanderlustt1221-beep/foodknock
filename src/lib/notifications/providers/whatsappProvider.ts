// src/lib/notifications/providers/whatsappProvider.ts
// FoodKnock Notification Engine — WhatsApp delivery provider.
//
// Mirrors emailDeliveryProvider.ts's exact structure: a thin adapter
// resolving a NotificationPayload into a call against the WhatsApp
// Business Cloud API client (whatsapp/client.ts) via the template
// registry (whatsapp/templates.ts). No HTTP, no template content, no
// phone formatting logic is duplicated here — all of that lives exactly
// once, in those two files.
//
// "Only TWO WhatsApp message flows exist. Nothing else." The switch
// below is genuinely exhaustive over every transactional event kind the
// engine knows about (the same set emailDeliveryProvider.ts's
// EmailPayloadData covers) — every kind except auth.otp_requested
// (signup flow only) and order.delivered is explicitly, deliberately
// skipped with a logged reason. This is a real, code-level guarantee:
// even if a future change accidentally adds "whatsapp" to some other
// event's default channels, this provider still refuses to send
// anything outside the two approved flows — not just a comment saying so.

import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { sendTemplateMessage } from "../whatsapp/client";
import { whatsappTemplateRegistry } from "../whatsapp/templates";
import type { SignupOtpContext, OrderDeliveredContext } from "../whatsapp/templates";
import { toWhatsAppPhoneFormat } from "../whatsapp/phoneFormat";
import type {
    DeliveryProvider,
    DeliveryResult,
    NotificationPayload,
    NotificationTarget,
} from "../types";

// ── WhatsApp-specific payload data shapes ────────────────────────────────
// Mirrors emailDeliveryProvider.ts's EmailPayloadData union exactly — the
// same set of `data.kind` values the engine's transactional templates
// produce — so this provider's switch can be genuinely exhaustive rather
// than guessing at which kinds might arrive.

type OtpRequestedData = {
    kind: "auth.otp_requested";
    flow: "reset" | "signup";
    otp: string;
    /** Phase 2: only ever set for flow:"signup" — see this file's send() for why. */
    phone?: string;
    name?: string;
};
type PasswordResetData = { kind: "auth.password_reset" };
type WelcomeData = { kind: "user.welcome" };
type OrderPlacedData = { kind: "order.placed"; orderId: string };
type OrderPreparingData = { kind: "order.preparing"; orderId: string };
type OrderOutForDeliveryData = { kind: "order.out_for_delivery"; orderId: string };
type OrderDeliveredData = { kind: "order.delivered"; orderId: string; customerName?: string };
type LoyaltyPointsCreditedData = { kind: "loyalty.points_credited" };
type ReferralRewardGrantedData = { kind: "referral.reward_granted" };

type WhatsAppPayloadData =
    | OtpRequestedData
    | PasswordResetData
    | WelcomeData
    | OrderPlacedData
    | OrderPreparingData
    | OrderOutForDeliveryData
    | OrderDeliveredData
    | LoyaltyPointsCreditedData
    | ReferralRewardGrantedData;

function isWhatsAppPayloadData(data: unknown): data is WhatsAppPayloadData {
    return !!data && typeof data === "object" && "kind" in data;
}

// ── User → phone resolution ───────────────────────────────────────────────
// Mirrors emailDeliveryProvider.ts's resolveUserContact exactly, for
// phone instead of email — target.userId is the only addressing the
// engine's NotificationTarget gives this provider.
async function resolveUserContact(userId: string): Promise<{ phone: string; name: string } | null> {
    await connectDB();
    const user = (await User.findById(userId).select("phone name").lean()) as
        | { phone?: string; name?: string }
        | null;

    if (!user?.phone) return null;
    return { phone: user.phone, name: user.name ?? "" };
}

export class WhatsAppDeliveryProvider implements DeliveryProvider {
    readonly channel = "whatsapp" as const;

    async send(target: NotificationTarget, payload: NotificationPayload): Promise<DeliveryResult> {
        const empty: DeliveryResult = { channel: "whatsapp", sent: 0, failed: 0, deactivated: 0 };

        if (!isWhatsAppPayloadData(payload.data)) {
            console.error(
                "WHATSAPP_PROVIDER_ERROR: payload.data is missing or has no `kind` — no WhatsApp template knows how to render this payload."
            );
            return { ...empty, failed: 1 };
        }

        // Phase 2 (Communication Layer): signup OTP is sent BEFORE any
        // User document exists — register/route.ts's PendingSignup-based
        // flow creates the account only after OTP verification succeeds
        // (see verify-signup-otp/route.ts). There is genuinely no
        // target.userId to resolve at this point, so the signup case
        // carries its contact directly in payload.data instead — set
        // ONLY by register/route.ts, for this one case. Every other kind
        // (reset OTP, order.delivered, everything else below) is
        // completely unaffected and still requires target.userId exactly
        // as before — this branch is the ONE exception, not a general
        // change to how contact resolution works.
        let contact: { phone: string; name: string } | null;

        if (payload.data.kind === "auth.otp_requested" && payload.data.flow === "signup" && payload.data.phone) {
            contact = { phone: payload.data.phone, name: payload.data.name ?? "" };
        } else {
            // WhatsApp is always user-addressed — broadcast/subscriptionIds
            // targeting (push-specific concepts) have no WhatsApp equivalent.
            if (!target.userId) {
                console.error(
                    `WHATSAPP_PROVIDER_ERROR: event "${payload.data.kind}" has no target.userId — WhatsApp delivery requires a specific user.`
                );
                return { ...empty, failed: 1 };
            }

            contact = await resolveUserContact(target.userId);
            if (!contact) {
                console.error(
                    `WHATSAPP_PROVIDER_ERROR: no phone number on file for user ${target.userId} — skipping "${payload.data.kind}".`
                );
                return { ...empty, failed: 1 };
            }
        }

        const to = toWhatsAppPhoneFormat(contact.phone);
        if (!to) {
            console.error(
                `WHATSAPP_PROVIDER_ERROR: phone number on file (${target.userId ?? "signup, no user yet"}) could not be normalized — skipping "${payload.data.kind}".`
            );
            return { ...empty, failed: 1 };
        }

        try {
            switch (payload.data.kind) {
                case "auth.otp_requested": {
                    const { flow, otp } = payload.data;
                    if (flow !== "signup") {
                        // Reset OTP stays email-only — not one of the two
                        // approved WhatsApp flows. Logged, not silently
                        // dropped, so the boundary is visible.
                        console.log(
                            `WHATSAPP_PROVIDER_SKIPPED: "auth.otp_requested" flow="${flow}" is not in WhatsApp scope (signup only).`
                        );
                        return empty;
                    }
                    const template = whatsappTemplateRegistry.get<SignupOtpContext>("auth.otp_signup");
                    if (!template) {
                        console.error('WHATSAPP_PROVIDER_ERROR: no template registered for "auth.otp_signup".');
                        return { ...empty, failed: 1 };
                    }
                    const result = await sendTemplateMessage({
                        to,
                        templateName: template.templateName,
                        languageCode: template.languageCode,
                        components: template.buildComponents({ otp }),
                    });
                    if (!result.ok) {
                        console.error(`WHATSAPP_PROVIDER_SEND_ERROR (auth.otp_signup):`, result.error);
                        return { ...empty, failed: 1 };
                    }
                    return { ...empty, sent: 1 };
                }

                case "order.delivered": {
                    const { orderId, customerName } = payload.data;
                    const template = whatsappTemplateRegistry.get<OrderDeliveredContext>("order.delivered");
                    if (!template) {
                        console.error('WHATSAPP_PROVIDER_ERROR: no template registered for "order.delivered".');
                        return { ...empty, failed: 1 };
                    }
                    const result = await sendTemplateMessage({
                        to,
                        templateName: template.templateName,
                        languageCode: template.languageCode,
                        components: template.buildComponents({
                            customerName: customerName || contact.name,
                            orderId,
                        }),
                    });
                    if (!result.ok) {
                        console.error(`WHATSAPP_PROVIDER_SEND_ERROR (order.delivered):`, result.error);
                        return { ...empty, failed: 1 };
                    }
                    return { ...empty, sent: 1 };
                }

                // ── Everything else is deliberately, explicitly out of scope ──
                // "Only TWO WhatsApp message flows exist. Nothing else." —
                // this is that rule enforced in code, not just stated in a
                // comment. Adding a third flow later means adding a real
                // case here (with a real template registered above), never
                // silently falling into one of these.
                case "auth.password_reset":
                case "user.welcome":
                case "order.placed":
                case "order.preparing":
                case "order.out_for_delivery":
                case "loyalty.points_credited":
                case "referral.reward_granted":
                    console.log(
                        `WHATSAPP_PROVIDER_SKIPPED: "${payload.data.kind}" is not one of the two approved WhatsApp flows (signup OTP, order delivered) — not sent.`
                    );
                    return empty;

                default: {
                    const _exhaustive: never = payload.data;
                    return _exhaustive;
                }
            }
        } catch (err) {
            console.error(`WHATSAPP_PROVIDER_SEND_ERROR (${payload.data.kind}):`, err);
            return { ...empty, failed: 1 };
        }
    }
}

export const whatsappProvider = new WhatsAppDeliveryProvider();