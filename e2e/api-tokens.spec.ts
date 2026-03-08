import { expect, test } from "@playwright/test";
import postgres from "postgres";

import type { APIRequestContext, Page } from "@playwright/test";

const TEST_ID = Date.now().toString(36);

const DB_URL =
  process.env.DATABASE_URL ?? "postgresql://timeless:timeless@localhost:5432/timeless";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uniqueEmail(prefix: string) {
  const suffix = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${TEST_ID}-${suffix}@e2e-test.local`;
}

async function registerAndLogin(
  page: Page,
  request: APIRequestContext,
  user: { name: string; email: string; password: string },
) {
  const signupRes = await request.post("/api/auth/sign-up/email", {
    data: {
      name: user.name,
      email: user.email,
      password: user.password,
    },
    headers: { "Content-Type": "application/json" },
  });
  expect(signupRes.ok()).toBeTruthy();

  const sql = postgres(DB_URL, { max: 1 });
  await sql`UPDATE better_auth_users SET email_verified = true WHERE email = ${user.email}`;
  await sql.end();

  await page.goto("/en/login");
  await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });
  await page.fill("input[type='email']", user.email);
  await page.fill("input[type='password']", user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/(?!.*\/login)/, { timeout: 15000 });
}

async function completeOnboarding(page: Page, companyName: string) {
  await expect(page).toHaveURL(/\/en\/no-account/, { timeout: 15000 });
  await page.getByRole("link", { name: /create an account/i }).click();
  await expect(page).toHaveURL(/\/en\/onboarding/, { timeout: 15000 });

  // Step 1
  await expect(page.locator("#companyName")).toBeVisible({ timeout: 15000 });
  // Use click + pressSequentially to ensure React onChange fires even during slow hydration
  await page.locator("#companyName").click();
  await page.locator("#companyName").pressSequentially(companyName, { delay: 30 });
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 2
  await expect(page.locator("#cinemaName")).toBeVisible({ timeout: 15000 });
  await page.locator("#cinemaName").click();
  await page.locator("#cinemaName").pressSequentially(`Cinema ${companyName}`, { delay: 30 });
  await page.locator("#cinemaCity").click();
  await page.locator("#cinemaCity").pressSequentially("Paris", { delay: 30 });
  await page.getByRole("button", { name: /add cinema/i }).click();
  await expect(page.getByText(`Cinema ${companyName}`)).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 3 — skip
  await expect(page.getByText(/invite your team/i)).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /skip this step/i }).click();
  await expect(page).toHaveURL(/\/en\/catalog/, { timeout: 30000 });
}

async function setupUser(page: Page, request: APIRequestContext, prefix: string) {
  const email = uniqueEmail(prefix);
  const companyName = `${prefix} Co ${TEST_ID}`;
  const user = { name: `${prefix} User`, email, password: "StrongPass123!" };
  await registerAndLogin(page, request, user);
  await completeOnboarding(page, companyName);
  return { companyName };
}

// ---------------------------------------------------------------------------
// API tokens tests
// ---------------------------------------------------------------------------
test.describe("API tokens", () => {
  test("API tab is visible for owner", async ({ page, request }) => {
    await setupUser(page, request, "apitoken-tab");

    await page.goto("/en/account/information");
    await expect(page.getByText(/^api$/i)).toBeVisible({ timeout: 15000 });
  });

  test("can create a token and see it once", async ({ page, request }) => {
    await setupUser(page, request, "apitoken-create");

    await page.goto("/en/account/api");

    // Should see empty state
    await expect(page.getByText(/no api keys yet/i)).toBeVisible({ timeout: 15000 });

    // Click create button
    await page.getByRole("button", { name: /create an api key/i }).click();

    // Fill dialog
    await expect(page.locator("#token-name")).toBeVisible({ timeout: 5000 });
    await page.fill("#token-name", `Test Key ${TEST_ID}`);
    await page.getByRole("button", { name: /^create$/i }).click();

    // Token created — should see the raw token (starts with tmls_)
    await expect(page.getByText(/copy this key now/i)).toBeVisible({ timeout: 5000 });

    // The token input should contain tmls_
    const tokenInput = page.locator("input[readonly]");
    await expect(tokenInput).toBeVisible();
    const tokenValue = await tokenInput.inputValue();
    expect(tokenValue).toMatch(/^tmls_/);

    // Close the dialog (first match = primary Close button, second = dialog X icon)
    await page.getByRole("button", { name: /close/i }).first().click();

    // Token should no longer be visible in full — only prefix in the table
    await expect(page.getByText(`Test Key ${TEST_ID}`)).toBeVisible({ timeout: 5000 });
    // Full token should not be visible anymore
    await expect(tokenInput).not.toBeVisible();
  });

  test("can revoke a token", async ({ page, request }) => {
    await setupUser(page, request, "apitoken-revoke");

    await page.goto("/en/account/api");

    // Create a token first
    await page.getByRole("button", { name: /create an api key/i }).click();
    await expect(page.locator("#token-name")).toBeVisible({ timeout: 5000 });
    await page.fill("#token-name", `Revoke Key ${TEST_ID}`);
    await page.getByRole("button", { name: /^create$/i }).click();
    await expect(page.getByText(/copy this key now/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /close/i }).first().click();

    // Verify token is in the table
    await expect(page.getByText(`Revoke Key ${TEST_ID}`)).toBeVisible({ timeout: 5000 });

    // Click revoke
    await page.getByRole("button", { name: /revoke/i }).click();

    // Confirm in dialog
    await expect(page.getByText(/revoke api key/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /revoke key/i }).click();

    // Should see success toast
    await expect(page.getByText(/api key revoked/i)).toBeVisible({ timeout: 5000 });

    // Token should disappear from the list
    await expect(page.getByText(`Revoke Key ${TEST_ID}`)).not.toBeVisible({ timeout: 5000 });
  });

  test("bearer token works for API calls", async ({ page, request }) => {
    await setupUser(page, request, "apitoken-bearer");

    await page.goto("/en/account/api");

    // Create a token
    await page.getByRole("button", { name: /create an api key/i }).click();
    await expect(page.locator("#token-name")).toBeVisible({ timeout: 5000 });
    await page.fill("#token-name", `Bearer Key ${TEST_ID}`);
    await page.getByRole("button", { name: /^create$/i }).click();
    await expect(page.getByText(/copy this key now/i)).toBeVisible({ timeout: 5000 });

    // Capture the token value
    const tokenInput = page.locator("input[readonly]");
    const token = await tokenInput.inputValue();

    await page.getByRole("button", { name: /close/i }).first().click();

    // Use token for API call
    const response = await request.get("/api/v1/cinemas", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBeTruthy();
    expect(body.data.length).toBeGreaterThan(0);
  });

  test("invalid bearer token returns 401", async ({ request }) => {
    const response = await request.get("/api/v1/cinemas", {
      headers: {
        Authorization: "Bearer tmls_invalid_token_12345678901234567890",
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("missing bearer token returns 401", async ({ request }) => {
    const response = await request.get("/api/v1/cinemas");
    expect(response.status()).toBe(401);
  });
});
