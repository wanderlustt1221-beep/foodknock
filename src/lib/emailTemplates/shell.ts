// src/lib/emailTemplates/shell.ts
// Reusable email template architecture for FoodKnock transactional emails.
//
// Every email is built from ONE shared HTML shell (consistent branded
// header/footer, mobile-responsive table-based layout for maximum email-
// client compatibility) plus a body-specific content block. This is the
// single place branding/layout lives — individual templates only supply
// their content, never re-implement the wrapper.

export const BRAND_NAME = "FoodKnock";
export const BRAND_TAGLINE = "Fresh. Fast. Flavourful.";
export const BRAND_COLOR = "#ea580c";
export const BRAND_COLOR_DARK = "#c2410c";

type EmailShellParams = {
    previewText: string;
    bodyHtml: string;
};

/**
 * Wraps a content block in the shared, mobile-responsive FoodKnock email
 * shell — branded header, content card, branded footer. Table-based layout
 * (not flex/grid) intentionally, since that's what renders consistently
 * across Gmail, Outlook, Apple Mail, and other email clients.
 */
export function renderEmailShell({ previewText, bodyHtml }: EmailShellParams): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background-color:#FFFBF5;font-family:Arial,Helvetica,sans-serif;">
  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(previewText)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#FFFBF5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${BRAND_COLOR},#f59e0b);border-radius:16px 16px 0 0;padding:28px 24px;text-align:center;">
              <div style="font-size:34px;line-height:1;margin-bottom:6px;">🍔</div>
              <div style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.3px;">${BRAND_NAME}</div>
              <div style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.85);margin-top:2px;">${BRAND_TAGLINE}</div>
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td style="background-color:#ffffff;border-left:1px solid #fde7d0;border-right:1px solid #fde7d0;padding:32px 28px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#fff7ed;border:1px solid #fde7d0;border-top:none;border-radius:0 0 16px 16px;padding:20px 28px;text-align:center;">
              <div style="font-size:12px;color:#78716c;line-height:1.6;">
                Need help? Email us at
                <a href="mailto:foodknock20@gmail.com" style="color:${BRAND_COLOR};font-weight:700;text-decoration:none;">foodknock20@gmail.com</a>
              </div>
              <div style="font-size:11px;color:#a8a29e;margin-top:10px;">
                © ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Minimal HTML escaping for any interpolated, user-influenced text fields
 * (names, addresses, notes). Shared across every template.
 */
export function escapeHtml(value: string): string {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Formats a number of paise-free rupees consistently across all templates.
 */
export function formatCurrency(amount: number): string {
    const safe = Number.isFinite(amount) ? amount : 0;
    return `₹${safe.toFixed(2).replace(/\.00$/, "")}`;
}

/**
 * Formats a Date consistently across all templates (India-friendly format,
 * no external date library — keeps this module dependency-free).
 */
export function formatDateTime(date: Date): string {
    return date.toLocaleString("en-IN", {
        day:    "numeric",
        month:  "short",
        year:   "numeric",
        hour:   "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

/**
 * Builds the shared plain-text footer appended to every template's text
 * fallback, keeping that consistent the same way the HTML footer is.
 */
export function plainTextFooter(): string {
    return `\n\n— ${BRAND_NAME}\nNeed help? Email foodknock20@gmail.com`;
}