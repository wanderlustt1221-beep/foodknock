// src/lib/emailTemplates/welcome.ts
// Welcome email — sent after successful signup verification.

import { renderEmailShell, escapeHtml, plainTextFooter, BRAND_COLOR } from "./shell";

export type WelcomeEmailData = {
    name: string;
};

function firstName(fullName: string): string {
    const trimmed = (fullName || "").trim();
    if (!trimmed) return "there";
    return trimmed.split(/\s+/)[0];
}

export function renderWelcomeEmailHtml(data: WelcomeEmailData): string {
    const first = firstName(data.name);

    const bodyHtml = `
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:40px;line-height:1;">🎉</div>
    </div>
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:900;color:#1c1917;text-align:center;">
      Welcome to FoodKnock, ${escapeHtml(first)}!
    </h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#57534e;text-align:center;">
      Your account is verified and ready to go. Get ready for fresh, fast, flavourful food — delivered right to your door.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
      <tr>
        <td style="background-color:#fff7ed;border:1px solid #fde7d0;border-radius:12px;padding:18px 20px;">
          <div style="font-size:13px;font-weight:800;color:${BRAND_COLOR};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">
            What's waiting for you
          </div>
          <div style="font-size:13px;color:#44403c;line-height:1.9;">
            ⚡ Ultra-fast checkout, every time<br/>
            🎁 Exclusive member-only deals<br/>
            💎 Loyalty points on every order<br/>
            🛵 Fresh food delivered fast
          </div>
        </td>
      </tr>
    </table>

    <div style="text-align:center;margin-top:24px;">
      <a href="https://foodknock.com" style="display:inline-block;background:linear-gradient(135deg,${BRAND_COLOR},#f59e0b);color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;padding:13px 32px;border-radius:10px;">
        Start Ordering
      </a>
    </div>
  `;

    return renderEmailShell({
        previewText: `Welcome to FoodKnock, ${first}! Your account is ready.`,
        bodyHtml,
    });
}

export function renderWelcomeEmailText(data: WelcomeEmailData): string {
    const first = firstName(data.name);
    return (
        `Welcome to FoodKnock, ${first}!\n\n` +
        `Your account is verified and ready to go. Get ready for fresh, fast, flavourful food — delivered right to your door.\n\n` +
        `What's waiting for you:\n` +
        `- Ultra-fast checkout, every time\n` +
        `- Exclusive member-only deals\n` +
        `- Loyalty points on every order\n` +
        `- Fresh food delivered fast\n` +
        plainTextFooter()
    );
}