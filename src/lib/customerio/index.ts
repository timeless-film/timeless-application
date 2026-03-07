import { APIClient, RegionUS, SendEmailRequest, TrackClient } from "customerio-node";

// ─── Clients ──────────────────────────────────────────────────────────────────

const cio = new TrackClient(process.env.CUSTOMERIO_SITE_ID!, process.env.CUSTOMERIO_API_KEY!, {
  region: RegionUS,
});

const cioApi = new APIClient(process.env.CUSTOMERIO_APP_API_KEY!, {
  region: RegionUS,
});

// ─── Transactional message IDs ───────────────────────────────────────────────
// Create these in Customer.io → Transactional → New Message, then set the IDs
// via env vars. If not set, falls back to inline email (no template needed).

const TRANSACTIONAL_IDS = {
  emailVerification: process.env.CIO_TRANSACTIONAL_VERIFY_EMAIL,
  passwordReset: process.env.CIO_TRANSACTIONAL_RESET_PASSWORD,
  memberInvitation: process.env.CIO_TRANSACTIONAL_INVITATION,
};

// ─── User sync ────────────────────────────────────────────────────────────────

export async function identifyUser(params: {
  userId: string;
  email: string;
  name: string;
  accountType: "exhibitor" | "rights_holder" | "admin";
  accountId: string;
  country?: string;
}) {
  await cio.identify(params.userId, {
    email: params.email,
    name: params.name,
    account_type: params.accountType,
    account_id: params.accountId,
    country: params.country,
    created_at: Math.floor(Date.now() / 1000),
  });
}

// ─── Track events ─────────────────────────────────────────────────────────────

export async function trackEvent(
  userId: string,
  eventName: string,
  data?: Record<string, unknown>
) {
  await cio.track(userId, { name: eventName, data });
}

export async function trackAnonymousEvent(
  anonymousId: string,
  eventName: string,
  data?: Record<string, unknown>
) {
  await cio.trackAnonymous(anonymousId, { name: eventName, data });
}

// ─── Transactional emails ────────────────────────────────────────────────────

/**
 * Send the email verification link to a newly registered user.
 */
export async function sendVerificationEmail(
  userId: string,
  email: string,
  name: string,
  url: string
) {
  // Identify the user first so CIO knows them
  await cio.identify(userId, { email, name, created_at: Math.floor(Date.now() / 1000) });

  const templateId = TRANSACTIONAL_IDS.emailVerification;

  if (templateId) {
    const req = new SendEmailRequest({
      transactional_message_id: templateId,
      to: email,
      identifiers: { id: userId },
      message_data: { verification_url: url, name },
    });
    await cioApi.sendEmail(req);
  } else {
    // Inline fallback (dev / no template configured)
    const req = new SendEmailRequest({
      to: email,
      identifiers: { id: userId },
      from: process.env.EMAIL_FROM ?? "hello@timeless.film",
      subject: "Verify your email — TIMELESS",
      body: `<p>Hi ${name},</p><p>Please verify your email by clicking the link below:</p><p><a href="${url}">Verify my email</a></p><p>— TIMELESS</p>`,
      message_data: { verification_url: url, name },
    });
    await cioApi.sendEmail(req);
  }
}

/**
 * Send the password reset link to a user.
 */
export async function sendResetPasswordEmail(userId: string, email: string, url: string) {
  await cio.identify(userId, { email });

  const templateId = TRANSACTIONAL_IDS.passwordReset;

  if (templateId) {
    const req = new SendEmailRequest({
      transactional_message_id: templateId,
      to: email,
      identifiers: { id: userId },
      message_data: { reset_url: url },
    });
    await cioApi.sendEmail(req);
  } else {
    const req = new SendEmailRequest({
      to: email,
      identifiers: { id: userId },
      from: process.env.EMAIL_FROM ?? "hello@timeless.film",
      subject: "Reset your password — TIMELESS",
      body: `<p>You requested a password reset.</p><p><a href="${url}">Reset my password</a></p><p>If you didn't request this, you can ignore this email.</p><p>— TIMELESS</p>`,
      message_data: { reset_url: url },
    });
    await cioApi.sendEmail(req);
  }
}

/**
 * Send an invitation email to join an organisation.
 */
export async function sendInvitationEmail(params: {
  email: string;
  inviteUrl: string;
  inviterName: string;
  accountName: string;
  role: string;
}) {
  const templateId = TRANSACTIONAL_IDS.memberInvitation;

  if (templateId) {
    const req = new SendEmailRequest({
      transactional_message_id: templateId,
      to: params.email,
      identifiers: { email: params.email },
      message_data: {
        invite_url: params.inviteUrl,
        inviter_name: params.inviterName,
        account_name: params.accountName,
        role: params.role,
      },
    });
    await cioApi.sendEmail(req);
  } else {
    const req = new SendEmailRequest({
      to: params.email,
      identifiers: { email: params.email },
      from: process.env.EMAIL_FROM ?? "hello@timeless.film",
      subject: `${params.inviterName} invited you to join ${params.accountName} — TIMELESS`,
      body: `<p>${params.inviterName} invited you to join <strong>${params.accountName}</strong> as <strong>${params.role}</strong>.</p><p><a href="${params.inviteUrl}">Accept the invitation</a></p><p>This invitation expires in 7 days.</p><p>— TIMELESS</p>`,
      message_data: {
        invite_url: params.inviteUrl,
        inviter_name: params.inviterName,
        account_name: params.accountName,
        role: params.role,
      },
    });
    await cioApi.sendEmail(req);
  }
}

// ─── Business events ──────────────────────────────────────────────────────────

export const CioEvents = {
  // Auth — lifecycle
  USER_INVITED: "user_invited",
  USER_ACTIVATED: "user_activated",

  // Catalogue
  FILM_ADDED: "film_added",
  FILM_IMPORTED: "film_imported",

  // Booking
  CART_ITEM_ADDED: "cart_item_added",
  REQUEST_SUBMITTED: "request_submitted",
  REQUEST_VALIDATED: "request_validated",
  REQUEST_REFUSED: "request_refused",
  REQUEST_EXPIRED: "request_expired",

  // Payment
  CHECKOUT_COMPLETED: "checkout_completed",
  PAYMENT_SUCCEEDED: "payment_succeeded",
  PAYMENT_FAILED: "payment_failed",

  // Delivery
  DELIVERY_CONFIRMED: "delivery_confirmed",

  // Finance
  WITHDRAWAL_INITIATED: "withdrawal_initiated",
  WITHDRAWAL_COMPLETED: "withdrawal_completed",
} as const;

export type CioEvent = (typeof CioEvents)[keyof typeof CioEvents];
