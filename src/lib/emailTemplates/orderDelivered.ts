// src/lib/emailTemplates/orderDelivered.ts
// Order delivered email — sent when an order's status transitions to
// "delivered" in the admin panel.

import { renderEmailShell, escapeHtml, plainTextFooter, BRAND_COLOR } from "./shell";

export type OrderDeliveredEmailData = {
    customerName: string;
    orderId:      string;
};

const REVIEW_URL = "https://foodknock.com/reviews";

export function renderOrderDeliveredEmailHtml(data: OrderDeliveredEmailData): string {
    const bodyHtml = `
    <div style="text-align:center;margin-bottom:18px;">
      <div style="font-size:46px;line-height:1;">🛵💨</div>
    </div>
    <h1 style="margin:0 0 10px;font-size:21px;font-weight:900;color:#1c1917;text-align:center;">
      Delivered fresh & fast! 🎉
    </h1>
    <p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#57534e;text-align:center;">
      Hi ${escapeHtml(data.customerName)}, your order just landed at your doorstep. We hope every bite hits the spot — thank you for choosing FoodKnock today!
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff7ed;border:1px solid #fde7d0;border-radius:12px;margin-bottom:22px;">
      <tr>
        <td style="padding:16px 18px;text-align:center;">
          <div style="font-size:11px;font-weight:800;color:#a16207;text-transform:uppercase;letter-spacing:0.05em;">Order Delivered</div>
          <div style="font-size:16px;font-weight:900;color:${BRAND_COLOR};margin-top:2px;">${escapeHtml(data.orderId)}</div>
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr>
        <td style="background-color:#fafaf9;border:1px solid #e7e5e4;border-radius:12px;padding:20px 18px;text-align:center;">
          <div style="font-size:15px;font-weight:800;color:#1c1917;margin-bottom:6px;">How was your meal?</div>
          <p style="margin:0 0 16px;font-size:12.5px;line-height:1.6;color:#78716c;">
            Your feedback helps us cook up an even better FoodKnock experience — and takes less than a minute.
          </p>
          <a href="${REVIEW_URL}" style="display:inline-block;background:linear-gradient(135deg,${BRAND_COLOR},#f59e0b);color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;padding:13px 30px;border-radius:10px;box-shadow:0 4px 14px rgba(234,88,12,0.3);">
            Rate Your Order ⭐⭐⭐⭐⭐
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;line-height:1.7;color:#78716c;text-align:center;">
      Every order also earns you loyalty points toward free food — see you again soon! 💎
    </p>

    <div style="text-align:center;margin-top:22px;">
      <a href="https://foodknock.com" style="display:inline-block;color:${BRAND_COLOR};font-size:13px;font-weight:800;text-decoration:none;">
        Order Again →
      </a>
    </div>
  `;

    return renderEmailShell({
        previewText: `Delivered! Rate your FoodKnock order ${data.orderId} in under a minute.`,
        bodyHtml,
    });
}

export function renderOrderDeliveredEmailText(data: OrderDeliveredEmailData): string {
    return (
        `Delivered fresh & fast! 🎉\n\n` +
        `Hi ${data.customerName}, your order just landed at your doorstep. We hope every bite hits the spot — thank you for choosing FoodKnock today!\n\n` +
        `Order Delivered: ${data.orderId}\n\n` +
        `How was your meal? Rate your order: ${REVIEW_URL}\n\n` +
        `Every order also earns you loyalty points toward free food — see you again soon!` +
        plainTextFooter()
    );
}