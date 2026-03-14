import { formatAmount } from "@/lib/pricing/format";
import { formatOrderNumber } from "@/lib/utils";

import { safeEmail } from "./safe-email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderConfirmationParams {
  orderNumber: number;
  exhibitorEmail: string;
  exhibitorCompanyName: string;
  items: Array<{
    filmTitle: string;
    cinemaName: string;
    roomName: string;
    screeningCount: number;
    displayedPrice: number;
    currency: string;
  }>;
  subtotal: number;
  deliveryFeesTotal: number;
  taxAmount: number;
  total: number;
  currency: string;
}

export interface RightsHolderOrderNotificationParams {
  rightsHolderEmail: string;
  rightsHolderCompanyName: string;
  exhibitorCompanyName: string;
  orderNumber: number;
  items: Array<{
    filmTitle: string;
    cinemaName: string;
    roomName: string;
    screeningCount: number;
    rightsHolderAmount: number;
    currency: string;
  }>;
  totalAmount: number;
  currency: string;
}

export interface OpsOrderNotificationParams {
  opsEmail: string;
  orderNumber: number;
  exhibitorCompanyName: string;
  items: Array<{
    filmTitle: string;
    rightsHolderName: string;
    cinemaName: string;
    roomName: string;
    startDate: string | null;
    endDate: string | null;
    screeningCount: number;
  }>;
  total: number;
  currency: string;
  orderId: string;
}

// ─── Exhibitor order confirmation ─────────────────────────────────────────────

export async function sendOrderConfirmationEmail(params: OrderConfirmationParams) {
  const orderRef = formatOrderNumber(params.orderNumber);
  const itemsHtml = params.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.filmTitle}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.cinemaName} — ${item.roomName}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.screeningCount}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: right;">${formatAmount(item.displayedPrice, item.currency, "en")}</td>
      </tr>`
    )
    .join("");

  await safeEmail("sendOrderConfirmation", {
    to: params.exhibitorEmail,
    subject: `Order confirmed — ${orderRef} — Timeless`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Order confirmed</h2>
        <p>Hello ${params.exhibitorCompanyName},</p>
        <p>Your order <strong>${orderRef}</strong> has been confirmed and paid.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px 12px; text-align: left;">Film</th>
              <th style="padding: 8px 12px; text-align: left;">Venue</th>
              <th style="padding: 8px 12px; text-align: left;">Screenings</th>
              <th style="padding: 8px 12px; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <table style="width: 100%; margin: 16px 0;">
          <tr>
            <td style="padding: 4px 12px;">Subtotal (excl. tax)</td>
            <td style="padding: 4px 12px; text-align: right;">${formatAmount(params.subtotal, params.currency, "en")}</td>
          </tr>
          ${
            params.deliveryFeesTotal > 0
              ? `<tr>
            <td style="padding: 4px 12px;">Delivery fees</td>
            <td style="padding: 4px 12px; text-align: right;">${formatAmount(params.deliveryFeesTotal, params.currency, "en")}</td>
          </tr>`
              : ""
          }
          <tr>
            <td style="padding: 4px 12px;">Tax</td>
            <td style="padding: 4px 12px; text-align: right;">${formatAmount(params.taxAmount, params.currency, "en")}</td>
          </tr>
          <tr style="font-weight: bold;">
            <td style="padding: 4px 12px;">Total</td>
            <td style="padding: 4px 12px; text-align: right;">${formatAmount(params.total, params.currency, "en")}</td>
          </tr>
        </table>

        <p>Our operations team will now process the delivery of your films.</p>
        <p><a href="${APP_URL}/en/orders">View your orders</a></p>

        <p style="color: #888; font-size: 12px; margin-top: 24px;">— The Timeless team</p>
      </div>
    `,
  });
}

// ─── Rights holder notification ───────────────────────────────────────────────

export async function sendRightsHolderOrderNotificationEmail(
  params: RightsHolderOrderNotificationParams
) {
  const orderRef = formatOrderNumber(params.orderNumber);
  const itemsHtml = params.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.filmTitle}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.cinemaName} — ${item.roomName}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.screeningCount}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: right;">${formatAmount(item.rightsHolderAmount, item.currency, "en")}</td>
      </tr>`
    )
    .join("");

  await safeEmail("sendRightsHolderOrderNotification", {
    to: params.rightsHolderEmail,
    subject: `New booking — ${orderRef} — Timeless`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New booking received</h2>
        <p>Hello ${params.rightsHolderCompanyName},</p>
        <p>A new booking has been placed by <strong>${params.exhibitorCompanyName}</strong> (${orderRef}).</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px 12px; text-align: left;">Film</th>
              <th style="padding: 8px 12px; text-align: left;">Venue</th>
              <th style="padding: 8px 12px; text-align: left;">Screenings</th>
              <th style="padding: 8px 12px; text-align: right;">Your revenue</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <p style="font-weight: bold;">
          Total revenue: ${formatAmount(params.totalAmount, params.currency, "en")}
        </p>

        <p>The transfer will be processed to your Stripe account automatically.</p>
        <p><a href="${APP_URL}/en/rights-holder/wallet">View your wallet</a></p>

        <p style="color: #888; font-size: 12px; margin-top: 24px;">— The Timeless team</p>
      </div>
    `,
  });
}

// ─── Ops notification ─────────────────────────────────────────────────────────

export async function sendOpsOrderNotificationEmail(params: OpsOrderNotificationParams) {
  const orderRef = formatOrderNumber(params.orderNumber);
  const itemsHtml = params.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.filmTitle}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.rightsHolderName}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.cinemaName} — ${item.roomName}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.startDate ?? "—"} → ${item.endDate ?? "—"}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.screeningCount}</td>
      </tr>`
    )
    .join("");

  await safeEmail("sendOpsOrderNotification", {
    to: params.opsEmail,
    subject: `[Ops] New order — ${orderRef}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New order to process</h2>
        <p><strong>Order:</strong> ${orderRef}</p>
        <p><strong>Exhibitor:</strong> ${params.exhibitorCompanyName}</p>
        <p><strong>Items:</strong> ${params.items.length} film(s)</p>
        <p><strong>Total:</strong> ${formatAmount(params.total, params.currency, "en")}</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px 12px; text-align: left;">Film</th>
              <th style="padding: 8px 12px; text-align: left;">Rights holder</th>
              <th style="padding: 8px 12px; text-align: left;">Venue</th>
              <th style="padding: 8px 12px; text-align: left;">Dates</th>
              <th style="padding: 8px 12px; text-align: left;">Screenings</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <p><a href="${APP_URL}/en/admin/orders/${params.orderId}">View order details</a></p>
      </div>
    `,
  });
}

// ─── Delivery confirmation (to exhibitor) ─────────────────────────────────────

export interface DeliveryConfirmationParams {
  recipientEmails: string[];
  filmTitle: string;
  cinemaName: string;
  roomName: string;
  orderNumber: number;
  deliveryNotes: string | null;
  deliveredAt: Date;
}

export async function sendDeliveryConfirmationEmail(params: DeliveryConfirmationParams) {
  const orderRef = formatOrderNumber(params.orderNumber);
  const deliveredDate = params.deliveredAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const notesBlock = params.deliveryNotes
    ? `<p><strong>Technical notes:</strong> ${params.deliveryNotes}</p>`
    : "";

  for (const email of params.recipientEmails) {
    await safeEmail("sendDeliveryConfirmation", {
      to: email,
      subject: `Delivery confirmed — ${params.filmTitle} — Timeless`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Delivery confirmed</h2>
          <p>Your film has been delivered and is ready for screening.</p>

          <table style="width: 100%; margin: 16px 0;">
            <tr>
              <td style="padding: 4px 12px; font-weight: bold;">Film</td>
              <td style="padding: 4px 12px;">${params.filmTitle}</td>
            </tr>
            <tr>
              <td style="padding: 4px 12px; font-weight: bold;">Venue</td>
              <td style="padding: 4px 12px;">${params.cinemaName} — ${params.roomName}</td>
            </tr>
            <tr>
              <td style="padding: 4px 12px; font-weight: bold;">Order</td>
              <td style="padding: 4px 12px;">${orderRef}</td>
            </tr>
            <tr>
              <td style="padding: 4px 12px; font-weight: bold;">Delivered on</td>
              <td style="padding: 4px 12px;">${deliveredDate}</td>
            </tr>
          </table>

          ${notesBlock}

          <p><a href="${APP_URL}/en/orders">View your orders</a></p>

          <p style="color: #888; font-size: 12px; margin-top: 24px;">— The Timeless team</p>
        </div>
      `,
    });
  }
}

// ─── Delivery alert (to ops) ──────────────────────────────────────────────────

export interface DeliveryAlertParams {
  opsEmail: string;
  urgentDeliveries: Array<{
    filmTitle: string;
    cinemaName: string;
    orderNumber: number;
    startDate: string;
    daysRemaining: number;
    deliveryStatus: string;
  }>;
}

export async function sendDeliveryAlertEmail(params: DeliveryAlertParams) {
  const itemsHtml = params.urgentDeliveries
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.filmTitle}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.cinemaName}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${formatOrderNumber(item.orderNumber)}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">${item.startDate}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: bold; color: ${item.daysRemaining <= 0 ? "#dc2626" : item.daysRemaining <= 2 ? "#f59e0b" : "#16a34a"};">
          ${item.daysRemaining <= 0 ? "OVERDUE" : `${item.daysRemaining}d`}
        </td>
      </tr>`
    )
    .join("");

  await safeEmail("sendDeliveryAlert", {
    to: params.opsEmail,
    subject: `[Ops] ${params.urgentDeliveries.length} urgent deliveries need attention`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Urgent deliveries</h2>
        <p>${params.urgentDeliveries.length} delivery(ies) are approaching or past their screening start date.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px 12px; text-align: left;">Film</th>
              <th style="padding: 8px 12px; text-align: left;">Cinema</th>
              <th style="padding: 8px 12px; text-align: left;">Order</th>
              <th style="padding: 8px 12px; text-align: left;">Start date</th>
              <th style="padding: 8px 12px; text-align: left;">Remaining</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <p><a href="${APP_URL}/en/admin/deliveries">View deliveries</a></p>
      </div>
    `,
  });
}
