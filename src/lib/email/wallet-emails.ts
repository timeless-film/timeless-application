import { formatAmount } from "@/lib/pricing/format";

import { safeEmail } from "./safe-email";

import { emailLayout, escapeHtml } from "./index";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function sendWithdrawalConfirmationEmail(params: {
  to: string;
  name: string;
  amount: number;
  currency: string;
  arrivalDate: string;
  walletUrl: string;
}): Promise<void> {
  const formattedAmount = formatAmount(params.amount, params.currency);
  const arrivalFormatted = new Date(params.arrivalDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  await safeEmail("withdrawalConfirmation", {
    to: params.to,
    subject: `Withdrawal confirmed — ${formattedAmount} — Timeless`,
    html: emailLayout(`
      <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#111111">Withdrawal confirmed</p>
      <p style="margin:0 0 24px 0;font-size:15px;color:#555555;line-height:1.5">
        Hello ${escapeHtml(params.name)}, your withdrawal of <strong>${formattedAmount}</strong> has been initiated.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0">
        <tr>
          <td style="padding:4px 12px;font-size:14px;font-weight:bold;color:#555555">Amount</td>
          <td style="padding:4px 12px;font-size:14px">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px;font-size:14px;font-weight:bold;color:#555555">Estimated arrival</td>
          <td style="padding:4px 12px;font-size:14px">${arrivalFormatted}</td>
        </tr>
      </table>

      <p style="margin:0 0 24px 0;font-size:14px;color:#555555">Funds will be deposited into your linked bank account within 1–2 business days.</p>
      <a href="${params.walletUrl}"
         style="display:inline-block;background:#111111;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
        View your wallet
      </a>
    `),
  });
}

export async function sendPayoutPaidEmail(params: {
  to: string;
  name: string;
  amount: number;
  currency: string;
  arrivalDate: string;
}): Promise<void> {
  const formattedAmount = formatAmount(params.amount, params.currency);

  await safeEmail("payoutPaid", {
    to: params.to,
    subject: `Payout received — ${formattedAmount} — Timeless`,
    html: emailLayout(`
      <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#111111">Payout received</p>
      <p style="margin:0 0 24px 0;font-size:15px;color:#555555;line-height:1.5">
        Hello ${escapeHtml(params.name)}, your payout of <strong>${formattedAmount}</strong> has been deposited into your bank account.
      </p>

      <a href="${APP_URL}/en/wallet"
         style="display:inline-block;background:#111111;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
        View your wallet
      </a>
    `),
  });
}

export async function sendPayoutFailedEmail(params: {
  to: string;
  name: string;
  amount: number;
  currency: string;
  failureMessage: string;
}): Promise<void> {
  const formattedAmount = formatAmount(params.amount, params.currency);

  await safeEmail("payoutFailed", {
    to: params.to,
    subject: `Payout failed — ${formattedAmount} — Timeless`,
    html: emailLayout(`
      <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#111111">Payout failed</p>
      <p style="margin:0 0 24px 0;font-size:15px;color:#555555;line-height:1.5">
        Hello ${escapeHtml(params.name)}, your payout of <strong>${formattedAmount}</strong> could not be completed.
      </p>
      <p style="margin:0 0 16px 0;font-size:14px;color:#555555">
        Reason: <strong>${escapeHtml(params.failureMessage)}</strong>
      </p>
      <p style="margin:0 0 24px 0;font-size:14px;color:#555555">Please verify your banking details in your Stripe dashboard.</p>
    `),
  });
}

export async function sendOpsPayoutFailedEmail(params: {
  opsEmail: string;
  connectAccountId: string;
  amount: number;
  currency: string;
  failureCode: string;
  failureMessage: string;
}): Promise<void> {
  const formattedAmount = formatAmount(params.amount, params.currency);

  await safeEmail("opsPayoutFailed", {
    to: params.opsEmail,
    subject: `[Ops] Payout failed for ${params.connectAccountId}`,
    html: emailLayout(`
      <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#111111">[Ops] Payout failure alert</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0">
        <tr>
          <td style="padding:4px 12px;font-size:14px;font-weight:bold;color:#555555">Connect Account</td>
          <td style="padding:4px 12px;font-size:14px">${escapeHtml(params.connectAccountId)}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px;font-size:14px;font-weight:bold;color:#555555">Amount</td>
          <td style="padding:4px 12px;font-size:14px">${formattedAmount}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px;font-size:14px;font-weight:bold;color:#555555">Failure Code</td>
          <td style="padding:4px 12px;font-size:14px">${escapeHtml(params.failureCode)}</td>
        </tr>
        <tr>
          <td style="padding:4px 12px;font-size:14px;font-weight:bold;color:#555555">Failure Message</td>
          <td style="padding:4px 12px;font-size:14px">${escapeHtml(params.failureMessage)}</td>
        </tr>
      </table>
    `),
  });
}
