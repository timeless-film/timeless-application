import { defineConfig, devices } from "@playwright/test";

/**
 * Dedicated port for E2E tests — intentionally different from the default
 * dev server (3000) to avoid conflicts when a dev instance is already running.
 */
const E2E_PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3099);
const baseURL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: process.env.CI ? "./e2e/global-setup.ts" : undefined,
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
      NEXT_PUBLIC_APP_URL: baseURL,
      RESEND_API_KEY: "", // Disable real email sending during E2E tests
    },
  },
});
