import { Resend } from "resend";

// ─── Client ───────────────────────────────────────────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM ?? "Timeless <hello@timeless.film>";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/**
 * Returns true when the app is running against the test database.
 * Used to block real email sends even when RESEND_API_KEY is set
 * (e.g. manually started dev server reused by Playwright).
 */
function isTestDatabase(): boolean {
  const url = process.env.DATABASE_URL ?? "";
  return url.includes("timeless_test");
}

/**
 * Safely execute an email send via Resend HTTP API.
 * - Logs errors but never throws — email is best-effort.
 * - Skips sending when RESEND_API_KEY is not configured.
 * - Skips sending when running against the test database (timeless_test).
 */
export async function safeEmail(
  label: string,
  params: { to: string; subject: string; html: string }
): Promise<void> {
  if (isTestDatabase()) {
    console.warn(`[Email] ${label} skipped: test database detected`);
    return;
  }

  if (!resend) {
    console.warn(`[Email] ${label} skipped: RESEND_API_KEY not configured`);
    console.warn(`[Email] Would send to ${params.to}: ${params.subject}`);
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      console.error(`[Email] ${label} failed:`, error);
    }
  } catch (err) {
    console.error(`[Email] ${label} failed:`, err);
  }
}
