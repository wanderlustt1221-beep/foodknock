// src/lib/notifications/whatsapp/phoneFormat.ts
//
// FoodKnock Notification Engine — WhatsApp phone formatting.
//
// The WhatsApp Cloud API requires the `to` field in E.164 format WITHOUT
// a leading "+" (e.g. "919876543210", not "+91 98765 43210"). User.phone
// is stored as a free-form trimmed string with no format enforced at the
// schema level, so this normalizes whatever's on file before it ever
// reaches the API client.
//
// FoodKnock operates in Danta, Sikar, Rajasthan (India) — confirmed from
// the business's own JSON-LD address in layout.tsx — so a bare 10-digit
// local number is assumed to be Indian and gets "91" prefixed. This is a
// real, business-context-grounded assumption, not an arbitrary default;
// flagged explicitly rather than silently baked in, since it's the one
// genuine judgment call in this file.

const INDIA_COUNTRY_CODE = "91";

/**
 * Returns a WhatsApp-ready phone string, or null if `rawPhone` can't be
 * turned into something plausible (too short after stripping non-digits).
 * Never throws — a malformed number on file is a data problem the caller
 * should log and skip, not something this function should crash over.
 */
export function toWhatsAppPhoneFormat(rawPhone: string): string | null {
    const digitsOnly = rawPhone.replace(/\D/g, "");

    if (digitsOnly.length === 10) {
        // Bare local number — no country code present, assume India.
        return `${INDIA_COUNTRY_CODE}${digitsOnly}`;
    }

    if (digitsOnly.length > 10 && digitsOnly.length <= 15) {
        // Already includes a country code (WhatsApp/E.164 numbers are at
        // most 15 digits total) — pass through as-is.
        return digitsOnly;
    }

    return null;
}