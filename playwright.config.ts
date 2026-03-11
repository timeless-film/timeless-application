import { defineConfig, devices } from "@playwright/test";

/**
 * Dedicated port for E2E tests — intentionally different from the default
 * dev server (3000) to avoid conflicts when a dev instance is already running.
 */
const E2E_PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3099);
const baseURL = `http://localhost:${E2E_PORT}`;

/**
 * Test database URL — set via .env.test (loaded by dotenv in package.json scripts)
 * or via DATABASE_URL env var. Falls back to the CI default.
 */
const testDatabaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://timeless:timeless@localhost:5432/timeless_test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  // CI runners are slow — give each test enough time for registration + onboarding + assertions
  timeout: process.env.CI ? 120_000 : 30_000,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `pnpm dev --port ${E2E_PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      PORT: String(E2E_PORT),
      DATABASE_URL: testDatabaseUrl,
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ??
        "test-e2e-auth-secret-do-not-use-in-production",
      NEXT_PUBLIC_APP_URL: baseURL,
      RESEND_API_KEY: "", // Disable real email sending during E2E tests
      STRIPE_SECRET_KEY:
        process.env.STRIPE_SECRET_KEY ?? "sk_test_fake_e2e_key",
      STRIPE_WEBHOOK_SECRET:
        process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_test_e2e_secret",
    },
  },
});
