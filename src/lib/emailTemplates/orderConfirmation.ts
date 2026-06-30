// src/lib/emailTemplates/orderConfirmation.ts
// Order confirmation email — sent to the customer immediately after a
// successful order creation (both COD and Razorpay flows). All amounts
// come from the already-created Order document (server-computed in
// createOrderCore), never recalculated or trusted from client input here.

import { renderEmailShell, escapeHtml, formatCurrency, formatDateTime, plainTextFooter, BRAND_COLOR } from "./shell";

export type OrderConfirmationItem = {
    name:     string;
    quantity: number;
    price:    number;
};

export type OrderConfirmationEmailData = {
    customerName: string;
    orderId:      string;
    items:        OrderConfirmationItem[];
    totalAmount:  number;
    deliveryFee:  number;
    platformFee:  number;
    address:      string;
    orderType:    string;
    paymentMethod: string;
    createdAt:    Date;
};

function itemsRowsHtml(items: OrderConfirmationItem[]): string {
    return items
        .map(
            (item) => `
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#1c1917;border-bottom:1px solid #f5f5f4;">
            ${escapeHtml(item.name)} <span style="color:#a8a29e;">× ${item.quantity}</span>
          </td>
          <td align="right" style="padding:8px 0;font-size:13px;font-weight:700;color:#1c1917;border-bottom:1px solid #f5f5f4;white-space:nowrap;">
            ${formatCurrency(item.price * item.quantity)}
          </td>
        </tr>`
        )
        .join("");
}

export function renderOrderConfirmationEmailHtml(data: OrderConfirmationEmailData): string {
    const isPickup = data.orderType === "pickup";

    const bodyHtml = `
    <div style="text-align:center;margin-bottom:18px;">
      <div style="font-size:38px;line-height:1;">✅</div>
    </div>
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:900;color:#1c1917;text-align:center;">
      Order Confirmed!
    </h1>
    <p style="margin:0 0 22px;font-size:13.5px;color:#78716c;text-align:center;">
      Thanks, ${escapeHtml(data.customerName)} — we're on it.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fff7ed;border:1px solid #fde7d0;border-radius:12px;margin-bottom:20px;">
      <tr>
        <td style="padding:14px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:11px;font-weight:800;color:#a16207;text-transform:uppercase;letter-spacing:0.05em;">Order ID</td>
              <td align="right" style="font-size:13px;font-weight:800;color:${BRAND_COLOR};">${escapeHtml(data.orderId)}</td>
            </tr>
            <tr>
              <td style="font-size:11px;color:#78716c;padding-top:6px;">Placed on</td>
              <td align="right" style="font-size:12px;color:#44403c;padding-top:6px;">${escapeHtml(formatDateTime(data.createdAt))}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="font-size:12px;font-weight:800;color:#1c1917;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">
      Your Order
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
      ${itemsRowsHtml(data.items)}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="padding:4px 0;font-size:12px;color:#78716c;">Delivery Fee</td>
        <td align="right" style="padding:4px 0;font-size:12px;color:#44403c;">${formatCurrency(data.deliveryFee)}</td>
      </tr>
      <tr>
        <td style="padding:4px 0;font-size:12px;color:#78716c;">Platform Fee</td>
        <td align="right" style="padding:4px 0;font-size:12px;color:#44403c;">${formatCurrency(data.platformFee)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0 0;font-size:14px;font-weight:900;color:#1c1917;border-top:1px solid #e7e5e4;">Total</td>
        <td align="right" style="padding:10px 0 0;font-size:16px;font-weight:900;color:${BRAND_COLOR};border-top:1px solid #e7e5e4;">${formatCurrency(data.totalAmount)}</td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">
      <tr>
        <td style="background-color:#fafaf9;border:1px solid #e7e5e4;border-radius:10px;padding:14px 16px;">
          <div style="font-size:11px;font-weight:800;color:#78716c;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">
            ${isPickup ? "Pickup" : "Delivery Address"}
          </div>
          <div style="font-size:13px;color:#1c1917;line-height:1.5;">
            ${isPickup ? "You chose store pickup" : escapeHtml(data.address)}
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:22px 0 0;font-size:12px;color:#a8a29e;text-align:center;">
      Payment method: ${escapeHtml(data.paymentMethod.toUpperCase())}
    </p>
  `;

    return renderEmailShell({
        previewText: `Your FoodKnock order ${data.orderId} is confirmed — total ${formatCurrency(data.totalAmount)}`,
        bodyHtml,
    });
}

export function renderOrderConfirmationEmailText(data: OrderConfirmationEmailData): string {
    const itemLines = data.items
        .map((i) => `  - ${i.name} x${i.quantity} — ${formatCurrency(i.price * i.quantity)}`)
        .join("\n");

    return (
        `Order Confirmed!\n\n` +
        `Thanks, ${data.customerName} — we're on it.\n\n` +
        `Order ID: ${data.orderId}\n` +
        `Placed on: ${formatDateTime(data.createdAt)}\n\n` +
        `Your Order:\n${itemLines}\n\n` +
        `Delivery Fee: ${formatCurrency(data.deliveryFee)}\n` +
        `Platform Fee: ${formatCurrency(data.platformFee)}\n` +
        `Total: ${formatCurrency(data.totalAmount)}\n\n` +
        `${data.orderType === "pickup" ? "Pickup" : "Delivery Address"}: ${data.orderType === "pickup" ? "Store pickup" : data.address}\n\n` +
        `Payment method: ${data.paymentMethod.toUpperCase()}` +
        plainTextFooter()
    );
}