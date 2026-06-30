// src/lib/notifications/whatsapp/client.ts
//
// FoodKnock Notification Engine — WhatsApp Business Cloud API client.
//
// Pure HTTP transport for the OFFICIAL Meta WhatsApp Business Cloud API
// (graph.facebook.com) — no business logic, no template content, no
// knowledge of "signup" vs "order delivered" lives here. This is the
// equivalent of what web-push (an npm package) is to webPushProvider.ts:
// the thing that actually talks to the wire, wrapped so the provider
// never constructs a raw fetch call itself.
//
// WhatsApp Business messages to a customer who hasn't messaged you in
// the last 24 hours MUST use a pre-approved message TEMPLATE (Meta's own
// platform constraint, not a choice made here) — this client only knows
// how to send template messages, since that's the only message type
// either of FoodKnock's two flows (signup OTP, order delivered) needs.

export type WhatsAppTemplateParameter = { type: "text"; text: string };

export type WhatsAppTemplateComponent =
    | { type: "body"; parameters: WhatsAppTemplateParameter[] }
    | { type: "button"; sub_type: "url"; index: string; parameters: WhatsAppTemplateParameter[] };

export type SendTemplateMessageInput = {
    /** Already-normalized via phoneFormat.ts — E.164 digits, no leading "+". */
    to: string;
    templateName: string;
    languageCode: string;
    components: WhatsAppTemplateComponent[];
};

export type SendTemplateMessageResult =
    | { ok: true; messageId: string }
    | { ok: false; error: string };

/**
 * Sends one WhatsApp template message via the official Cloud API. Never
 * throws — every failure (missing config, network error, API error
 * response) resolves to `{ ok: false, error }` so the calling provider
 * can translate it into a DeliveryResult without its own try/catch
 * needing to guess at this function's failure modes.
 */
export async function sendTemplateMessage(input: SendTemplateMessageInput): Promise<SendTemplateMessageResult> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v21.0";

    if (!phoneNumberId || !accessToken) {
        return {
            ok: false,
            error: "WHATSAPP_PHONE_NUMBER_ID and/or WHATSAPP_ACCESS_TOKEN are not configured.",
        };
    }

    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: input.to,
                type: "template",
                template: {
                    name: input.templateName,
                    language: { code: input.languageCode },
                    components: input.components,
                },
            }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            const message =
                (data && typeof data === "object" && "error" in data
                    ? (data as { error?: { message?: string } }).error?.message
                    : null) ?? `WhatsApp API returned HTTP ${response.status}`;
            return { ok: false, error: message };
        }

        const messageId = (data as { messages?: Array<{ id?: string }> } | null)?.messages?.[0]?.id;
        if (!messageId) {
            return { ok: false, error: "WhatsApp API response did not include a message id." };
        }

        return { ok: true, messageId };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}