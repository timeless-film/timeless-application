import nodemailer from "nodemailer";

import type { SentMessageInfo, Transporter } from "nodemailer";

// ─── Client ───────────────────────────────────────────────────────────────────

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const EMAIL_ENABLED =
  !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASSWORD;

// Port 465 uses implicit TLS (SMTPS); port 587 uses STARTTLS.
const smtpPort = parseInt(process.env.SMTP_PORT ?? "465");

/**
 * In production: use real SMTP credentials from env vars.
 * In development: use Ethereal (nodemailer's built-in fake SMTP).
 *   - No config needed — a test account is created on first send.
 *   - Each sent email logs a preview URL to the console.
 *   - Emails are never actually delivered.
 */
async function getTransporter(): Promise<Transporter> {
  if (IS_PRODUCTION || EMAIL_ENABLED) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  // Dev fallback: Ethereal fake SMTP
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

const FROM = process.env.EMAIL_FROM ?? "hello@timeless.film";

/**
 * Safely execute an email send — logs errors but never throws.
 * Email sends are best-effort and must never break the main application flow.
 * In development, logs a preview URL to the console (Ethereal).
 */
async function safeEmail(
  label: string,
  fn: (transport: Transporter) => Promise<SentMessageInfo>
): Promise<SentMessageInfo | undefined> {
  if (IS_PRODUCTION && !EMAIL_ENABLED) {
    console.warn(`[Email] ${label} skipped: SMTP not configured`);
    return undefined;
  }
  try {
    const transport = await getTransporter();
    const result = await fn(transport);
    // In dev, log the Ethereal preview URL so you can inspect the email in a browser
    if (!IS_PRODUCTION) {
      console.warn(`[Email] ${label} preview: ${nodemailer.getTestMessageUrl(result)}`);
    }
    return result;
  } catch (err) {
    console.error(`[Email] ${label} failed:`, err);
    return undefined;
  }
}

// ─── Transactional emails ─────────────────────────────────────────────────────

/**
 * Send the email verification link to a newly registered user.
 */
export async function sendVerificationEmail(
  _userId: string,
  email: string,
  name: string,
  url: string
) {
  await safeEmail("sendVerificationEmail", (transport) =>
    transport.sendMail({
      from: FROM,
      to: email,
      subject: "Verify your email — Timeless",
      html: verificationEmailHtml(name, url),
    })
  );
}

/**
 * Send the password reset link to a user.
 */
export async function sendResetPasswordEmail(_userId: string, email: string, url: string) {
  await safeEmail("sendResetPasswordEmail", (transport) =>
    transport.sendMail({
      from: FROM,
      to: email,
      subject: "Reset your password — Timeless",
      html: resetPasswordEmailHtml(url),
    })
  );
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
  await safeEmail("sendInvitationEmail", (transport) =>
    transport.sendMail({
      from: FROM,
      to: params.email,
      subject: `${params.inviterName} invited you to join ${params.accountName} — Timeless`,
      html: invitationEmailHtml(params),
    })
  );
}

// ─── HTML templates ───────────────────────────────────────────────────────────

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:48px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;padding:40px">
        <tr><td>
          <p style="margin:0 0 32px 0;font-size:18px;font-weight:600;letter-spacing:0.05em;color:#111111">Timeless</p>
          ${content}
          <hr style="border:none;border-top:1px solid #eeeeee;margin:32px 0">
          <p style="margin:0;font-size:12px;color:#999999">© Timeless — <a href="https://timeless.film" style="color:#999999">timeless.film</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function verificationEmailHtml(name: string, url: string): string {
  return emailLayout(`
    <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#111111">Verify your email</p>
    <p style="margin:0 0 24px 0;font-size:15px;color:#555555;line-height:1.5">
      Hi ${name}, please verify your email address to activate your Timeless account.
    </p>
    <a href="${url}"
       style="display:inline-block;background:#111111;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
      Verify my email
    </a>
    <p style="margin:24px 0 0 0;font-size:13px;color:#999999">
      If you didn't create an account, you can safely ignore this email.
    </p>
  `);
}

function resetPasswordEmailHtml(url: string): string {
  return emailLayout(`
    <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#111111">Reset your password</p>
    <p style="margin:0 0 24px 0;font-size:15px;color:#555555;line-height:1.5">
      We received a request to reset your Timeless password. Click the button below to proceed.
    </p>
    <a href="${url}"
       style="display:inline-block;background:#111111;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
      Reset my password
    </a>
    <p style="margin:24px 0 0 0;font-size:13px;color:#999999">
      If you didn't request a password reset, you can safely ignore this email.
    </p>
  `);
}

function invitationEmailHtml(params: {
  inviterName: string;
  accountName: string;
  role: string;
  inviteUrl: string;
}): string {
  return emailLayout(`
    <p style="margin:0 0 8px 0;font-size:22px;font-weight:600;color:#111111">You've been invited</p>
    <p style="margin:0 0 24px 0;font-size:15px;color:#555555;line-height:1.5">
      <strong>${params.inviterName}</strong> has invited you to join
      <strong>${params.accountName}</strong> as <strong>${params.role}</strong> on Timeless.
    </p>
    <a href="${params.inviteUrl}"
       style="display:inline-block;background:#111111;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:500">
      Accept the invitation
    </a>
    <p style="margin:24px 0 0 0;font-size:13px;color:#999999">
      This invitation expires in 7 days.
    </p>
  `);
}
