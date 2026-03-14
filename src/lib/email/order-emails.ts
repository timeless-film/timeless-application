import { formatAmount } from "@/lib/pricing/format";
import { formatOrderNumber } from "@/lib/utils";

import { safeEmail } from "./safe-email";

import { emailLayout, escapeHtml } from "./index";

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
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${escapeHtml(item.filmTitle)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${escapeHtml(item.cinemaName)} — ${escapeHtml(item.roomName)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${item.screeningCount}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px">${formatAmount(item.displayedPrice, item.currency, "en")}</td>
      </tr>`
    )
    .join("");

  await safeEmail("sendOrderConfirmation", {
    to: params.exhibitorEmail,
    subject: `Order confirmed — ${orderRef} — Timeless`,
    html: emailLayout(`
      <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#111111">Order confirmed</p>
      <p style="margin:0 0 24px 0;font-size:15px;color:#555555;line-height:1.5">
        Hello ${escapeHtml(params.exhibitorCompanyName)}, your order <strong>${orderRef}</strong> has been confirmed and paid.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px 0">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Film</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Venue</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Screenings</th>
            <th style="padding:8px 12px;text-align:right;font-size:13px;color:#555555">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0">
        <tr>
          <td style="padding:4px 12px;font-size:14px;color:#555555">Subtotal (excl. tax)</td>
          <td style="padding:4px 12px;font-size:14px;text-align:right">${formatAmount(params.subtotal, params.currency, "en")}</td>
        </tr>
        ${
          params.deliveryFeesTotal > 0
            ? `<tr>
          <td style="padding:4px 12px;font-size:14px;color:#555555">Delivery fees</td>
          <td style="padding:4px 12px;font-size:14px;text-align:right">${formatAmount(params.deliveryFeesTotal, params.currency, "en")}</td>
        </tr>`
            : ""
        }
        <tr>
          <td style="padding:4px 12px;font-size:14px;color:#555555">Tax</td>
          <td style="padding:4px 12px;font-size:14px;text-align:right">${formatAmount(params.taxAmount, params.currency, "en")}</td>
        </tr>
        <tr style="font-weight:bold">
          <td style="padding:4px 12px;font-size:14px">Total</td>
          <td style="padding:4px 12px;font-size:14px;text-align:right">${formatAmount(params.total, params.currency, "en")}</td>
        </tr>
      </table>

      <p style="margin:0 0 24px 0;font-size:14px;color:#555555">Our operations team will now process the delivery of your films.</p>
      <a href="${APP_URL}/en/orders"
         style="display:inline-block;background:#111111;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
        View your orders
      </a>
    `),
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
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${escapeHtml(item.filmTitle)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${escapeHtml(item.cinemaName)} — ${escapeHtml(item.roomName)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${item.screeningCount}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-size:14px">${formatAmount(item.rightsHolderAmount, item.currency, "en")}</td>
      </tr>`
    )
    .join("");

  await safeEmail("sendRightsHolderOrderNotification", {
    to: params.rightsHolderEmail,
    subject: `New booking — ${orderRef} — Timeless`,
    html: emailLayout(`
      <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#111111">New booking received</p>
      <p style="margin:0 0 24px 0;font-size:15px;color:#555555;line-height:1.5">
        Hello ${escapeHtml(params.rightsHolderCompanyName)}, a new booking has been placed by <strong>${escapeHtml(params.exhibitorCompanyName)}</strong> (${orderRef}).
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px 0">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Film</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Venue</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Screenings</th>
            <th style="padding:8px 12px;text-align:right;font-size:13px;color:#555555">Your revenue</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <p style="margin:0 0 8px 0;font-size:15px;font-weight:bold;color:#111111">
        Total revenue: ${formatAmount(params.totalAmount, params.currency, "en")}
      </p>

      <p style="margin:0 0 24px 0;font-size:14px;color:#555555">The transfer will be processed to your Stripe account automatically.</p>
      <a href="${APP_URL}/en/wallet"
         style="display:inline-block;background:#111111;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
        View your wallet
      </a>
    `),
  });
}

// ─── Ops notification ─────────────────────────────────────────────────────────

export async function sendOpsOrderNotificationEmail(params: OpsOrderNotificationParams) {
  const orderRef = formatOrderNumber(params.orderNumber);
  const itemsHtml = params.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${escapeHtml(item.filmTitle)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${escapeHtml(item.rightsHolderName)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${escapeHtml(item.cinemaName)} — ${escapeHtml(item.roomName)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${item.startDate ?? "—"} → ${item.endDate ?? "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${item.screeningCount}</td>
      </tr>`
    )
    .join("");

  await safeEmail("sendOpsOrderNotification", {
    to: params.opsEmail,
    subject: `[Ops] New order — ${orderRef}`,
    html: emailLayout(`
      <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#111111">New order to process</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0">
        <tr>
          <td style="padding:4px 12px;font-size:14px;font-weight:bold;color:#555555">Order</td>
          <td style="padding:4px 12px;font-size:14px">${orderRef}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px;font-size:14px;font-weight:bold;color:#555555">Exhibitor</td>
          <td style="padding:4px 12px;font-size:14px">${escapeHtml(params.exhibitorCompanyName)}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px;font-size:14px;font-weight:bold;color:#555555">Items</td>
          <td style="padding:4px 12px;font-size:14px">${params.items.length} film(s)</td>
        </tr>
        <tr>
          <td style="padding:4px 12px;font-size:14px;font-weight:bold;color:#555555">Total</td>
          <td style="padding:4px 12px;font-size:14px">${formatAmount(params.total, params.currency, "en")}</td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px 0">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Film</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Rights holder</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Venue</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Dates</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Screenings</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <a href="${APP_URL}/en/admin/orders/${params.orderId}"
         style="display:inline-block;background:#111111;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
        View order details
      </a>
    `),
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
    ? `<p style="margin:0 0 16px 0;font-size:14px;color:#555555"><strong>Technical notes:</strong> ${escapeHtml(params.deliveryNotes)}</p>`
    : "";

  for (const email of params.recipientEmails) {
    await safeEmail("sendDeliveryConfirmation", {
      to: email,
      subject: `Delivery confirmed — ${escapeHtml(params.filmTitle)} — Timeless`,
      html: emailLayout(`
        <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#111111">Delivery confirmed</p>
        <p style="margin:0 0 24px 0;font-size:15px;color:#555555;line-height:1.5">
          Your film has been delivered and is ready for screening.
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0">
          <tr>
            <td style="padding:4px 12px;font-size:14px;font-weight:bold;color:#555555">Film</td>
            <td style="padding:4px 12px;font-size:14px">${escapeHtml(params.filmTitle)}</td>
          </tr>
          <tr>
            <td style="padding:4px 12px;font-size:14px;font-weight:bold;color:#555555">Venue</td>
            <td style="padding:4px 12px;font-size:14px">${escapeHtml(params.cinemaName)} — ${escapeHtml(params.roomName)}</td>
          </tr>
          <tr>
            <td style="padding:4px 12px;font-size:14px;font-weight:bold;color:#555555">Order</td>
            <td style="padding:4px 12px;font-size:14px">${orderRef}</td>
          </tr>
          <tr>
            <td style="padding:4px 12px;font-size:14px;font-weight:bold;color:#555555">Delivered on</td>
            <td style="padding:4px 12px;font-size:14px">${deliveredDate}</td>
          </tr>
        </table>

        ${notesBlock}

        <a href="${APP_URL}/en/orders"
           style="display:inline-block;background:#111111;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
          View your orders
        </a>
      `),
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
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${escapeHtml(item.filmTitle)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${escapeHtml(item.cinemaName)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${formatOrderNumber(item.orderNumber)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px">${item.startDate}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold;color:${item.daysRemaining <= 0 ? "#dc2626" : item.daysRemaining <= 2 ? "#f59e0b" : "#16a34a"}">
          ${item.daysRemaining <= 0 ? "OVERDUE" : `${item.daysRemaining}d`}
        </td>
      </tr>`
    )
    .join("");

  await safeEmail("sendDeliveryAlert", {
    to: params.opsEmail,
    subject: `[Ops] ${params.urgentDeliveries.length} urgent deliveries need attention`,
    html: emailLayout(`
      <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#111111">Urgent deliveries</p>
      <p style="margin:0 0 24px 0;font-size:15px;color:#555555;line-height:1.5">
        ${params.urgentDeliveries.length} delivery(ies) are approaching or past their screening start date.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px 0">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Film</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Cinema</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Order</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Start date</th>
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#555555">Remaining</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <a href="${APP_URL}/en/admin/deliveries"
         style="display:inline-block;background:#111111;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
        View deliveries
      </a>
    `),
  });
}
