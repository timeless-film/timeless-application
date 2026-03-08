/**
 * Global setup for Playwright E2E tests on CI.
 *
 * Pre-fetches key pages to trigger Next.js compilation before the first test
 * runs, avoiding cold-start timeouts that eat into individual test budgets.
 */
const BASE_URL = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? 3099}`;

const WARMUP_PATHS = [
  "/en/login",
  "/en/register",
  "/en/forgot-password",
  "/api/auth/session",
  "/en/onboarding",
];

export default async function globalSetup() {
  // eslint-disable-next-line no-console
  console.log("[global-setup] Warming up Next.js pages…");

  for (const path of WARMUP_PATHS) {
    try {
      const response = await fetch(`${BASE_URL}${path}`);
      // eslint-disable-next-line no-console
      console.log(`[global-setup] ${path} → ${response.status}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(`[global-setup] ${path} → failed (server might still be starting)`);
    }
  }

  // eslint-disable-next-line no-console
  console.log("[global-setup] Warmup complete.");
}
