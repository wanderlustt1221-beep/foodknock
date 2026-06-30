// src/lib/notifications/whatsapp/templates.ts
//
// FoodKnock Notification Engine — WhatsApp template registry.
//
// "Create reusable provider architecture. Future templates should be
// easy to add." Mirrors the EXACT registry pattern already used
// throughout this codebase (audienceResolverRegistry, scheduleResolverRegistry,
// conditionFieldRegistry) — a Map keyed by a stable string, one class per
// template, one register() call. Adding a third WhatsApp template later
// means writing one new definition below and registering it — nothing
// in whatsappProvider.ts or client.ts changes.
//
// Template NAMES are environment-configurable (with a sensible default)
// because they're approved through Meta's own Business Manager — a real,
// external, admin-controlled process — and commonly differ between
// staging and production (e.g. a "_test" suffix during template review).

import type { WhatsAppTemplateComponent } from "./client";

export type WhatsAppTemplateKey = "auth.otp_signup" | "order.delivered";

export interface WhatsAppTemplateDefinition<TContext> {
    readonly key: WhatsAppTemplateKey;
    readonly templateName: string;
    readonly languageCode: string;
    buildComponents(context: TContext): WhatsAppTemplateComponent[];
}

class WhatsAppTemplateRegistry {
    private templates = new Map<WhatsAppTemplateKey, WhatsAppTemplateDefinition<unknown>>();

    register<TContext>(template: WhatsAppTemplateDefinition<TContext>): void {
        this.templates.set(template.key, template as WhatsAppTemplateDefinition<unknown>);
    }

    get<TContext>(key: WhatsAppTemplateKey): WhatsAppTemplateDefinition<TContext> | undefined {
        return this.templates.get(key) as WhatsAppTemplateDefinition<TContext> | undefined;
    }
}

export const whatsappTemplateRegistry = new WhatsAppTemplateRegistry();

const DEFAULT_LANGUAGE_CODE = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en";

// ── Signup OTP ─────────────────────────────────────────────────────────
// A WhatsApp "Authentication"-category template: one body variable for
// the code itself. The exact approved template's wording (and any
// "copy code" button it may include) lives entirely in Meta's Business
// Manager, not here — this only supplies the variable.
export type SignupOtpContext = { otp: string };

whatsappTemplateRegistry.register<SignupOtpContext>({
    key: "auth.otp_signup",
    templateName: process.env.WHATSAPP_TEMPLATE_SIGNUP_OTP || "foodknock_signup_otp",
    languageCode: DEFAULT_LANGUAGE_CODE,
    buildComponents: ({ otp }) => [
        { type: "body", parameters: [{ type: "text", text: otp }] },
    ],
});

// ── Order Delivered ──────────────────────────────────────────────────
// A "Utility"-category template: body mentions the customer/order, and
// the review CTA (https://www.foodknock.com/reviews) is a STATIC URL
// button baked into the approved template itself — the brief specifies
// one fixed link, not a per-order dynamic one, so no button parameter
// is needed here. If a future template needs a dynamic URL suffix
// instead, add a "button" component to this list — buildComponents'
// return type already supports it (see client.ts's
// WhatsAppTemplateComponent union).
export type OrderDeliveredContext = { customerName: string; orderId: string };

whatsappTemplateRegistry.register<OrderDeliveredContext>({
    key: "order.delivered",
    templateName: process.env.WHATSAPP_TEMPLATE_ORDER_DELIVERED || "foodknock_order_delivered",
    languageCode: DEFAULT_LANGUAGE_CODE,
    buildComponents: ({ customerName, orderId }) => [
        { type: "body", parameters: [{ type: "text", text: customerName }, { type: "text", text: orderId }] },
    ],
});