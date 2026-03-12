import { formatAmount } from "@/lib/pricing/format";

import { safeEmail } from "./safe-email";

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
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Withdrawal confirmed</h2>
        <p>Hello ${params.name},</p>
        <p>Your withdrawal of <strong>${formattedAmount}</strong> has been initiated.</p>
        <p>Estimated arrival date: <strong>${arrivalFormatted}</strong></p>
        <p>Funds will be deposited into your linked bank account within 1–2 business days.</p>
        <p style="margin-top: 24px;">
          <a href="${params.walletUrl}" style="background-color: #18181b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View your wallet
          </a>
        </p>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">
          Timeless · ${APP_URL}
        </p>
      </div>
    `,
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
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payout received</h2>
        <p>Hello ${params.name},</p>
        <p>Your payout of <strong>${formattedAmount}</strong> has been deposited into your bank account.</p>
        <p style="margin-top: 24px;">
          <a href="${APP_URL}/wallet" style="background-color: #18181b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View your wallet
          </a>
        </p>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">
          Timeless · ${APP_URL}
        </p>
      </div>
    `,
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
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payout failed</h2>
        <p>Hello ${params.name},</p>
        <p>Your payout of <strong>${formattedAmount}</strong> could not be completed.</p>
        <p>Reason: <strong>${params.failureMessage}</strong></p>
        <p>Please verify your banking details in your Stripe dashboard.</p>
        <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
        <p style="color: #6b7280; font-size: 12px;">
          Timeless · ${APP_URL}
        </p>
      </div>
    `,
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
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>[Ops] Payout failure alert</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 4px 8px; font-weight: bold;">Connect Account</td><td style="padding: 4px 8px;">${params.connectAccountId}</td></tr>
          <tr><td style="padding: 4px 8px; font-weight: bold;">Amount</td><td style="padding: 4px 8px;">${formattedAmount}</td></tr>
          <tr><td style="padding: 4px 8px; font-weight: bold;">Failure Code</td><td style="padding: 4px 8px;">${params.failureCode}</td></tr>
          <tr><td style="padding: 4px 8px; font-weight: bold;">Failure Message</td><td style="padding: 4px 8px;">${params.failureMessage}</td></tr>
        </table>
      </div>
    `,
  });
}
