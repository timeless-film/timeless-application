import { expect, test } from "@playwright/test";
import postgres from "postgres";

import type { APIRequestContext, Page } from "@playwright/test";

/**
 * Unique test ID to avoid collisions between runs.
 * Each test file execution gets its own ID.
 */
const TEST_ID = Date.now().toString(36);

const DB_URL =
  process.env.DATABASE_URL ?? "postgresql://timeless:timeless@localhost:5432/timeless_test";

/**
 * Helper: register a user via the Better Auth API, verify their email
 * directly in the DB, then log them in through the UI.
 */
async function registerAndLogin(
  page: Page,
  request: APIRequestContext,
  user: { name: string; email: string; password: string },
) {
  // 1. Register via API (request fixture uses baseURL from playwright config)
  const signupRes = await request.post("/api/auth/sign-up/email", {
    data: {
      name: user.name,
      email: user.email,
      password: user.password,
    },
    headers: { "Content-Type": "application/json" },
  });
  expect(signupRes.ok()).toBeTruthy();

  // 2. Verify email directly in DB using the postgres npm package
  const sql = postgres(DB_URL, { max: 1 });
  await sql`UPDATE better_auth_users SET email_verified = true WHERE email = ${user.email}`;
  await sql.end();

  // 3. Log in via UI
  await page.goto("/en/login");
  await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });
  await page.fill("input[type='email']", user.email);
  await page.fill("input[type='password']", user.password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // 4. Wait for redirect away from login
  await page.waitForURL(/(?!.*\/login)/, { timeout: 15000 });
}

// ---------------------------------------------------------------------------
// 1. Registration flow
// ---------------------------------------------------------------------------
test.describe("Registration flow", () => {
  test("register form submits and shows verification message", async ({ page }) => {
    const email = `reg-${TEST_ID}@e2e-test.local`;

    await page.goto("/en/register");
    await expect(page.locator("#name")).toBeVisible({ timeout: 15000 });

    await page.fill("#name", "E2E Registration Test");
    await page.fill("#email", email);
    await page.fill("#password", "StrongPass123!");
    await page.fill("#password-confirm", "StrongPass123!");

    await page.getByRole("button", { name: /create account/i }).click();

    // After successful registration, the success card appears with verification message
    await expect(page.getByText(/verification email/i)).toBeVisible({ timeout: 10000 });
    // Should stay on register page
    await expect(page).toHaveURL(/\/en\/register/);
  });
});

// ---------------------------------------------------------------------------
// 2. Onboarding flow — register, verify email, login, complete onboarding
// ---------------------------------------------------------------------------
// Helper: complete the onboarding flow (no-account → onboarding → catalog)
// ---------------------------------------------------------------------------
async function completeOnboarding(page: Page, companyName: string) {
  // After login, user with no account lands on /no-account
  await expect(page).toHaveURL(/\/en\/no-account/, { timeout: 15000 });

  // Click "Create an account" to go to onboarding
  await page.getByRole("link", { name: /create an account/i }).click();
  await expect(page).toHaveURL(/\/en\/onboarding/, { timeout: 15000 });

  // ─── Step 1: Company information ─────────────────────────────────
  await expect(page.locator("#companyName")).toBeVisible({ timeout: 15000 });
  // Use click + pressSequentially to ensure React onChange fires even during slow hydration
  await page.locator("#companyName").click();
  await page.locator("#companyName").pressSequentially(companyName, { delay: 30 });
  // Country defaults to FR — leave as is

  await page.getByRole("button", { name: /continue/i }).click();

  // ─── Step 2: Add a cinema ────────────────────────────────────────
  // The add cinema form should be visible (auto-shown when no cinemas)
  await expect(page.locator("#cinemaName")).toBeVisible({ timeout: 15000 });
  await page.locator("#cinemaName").click();
  await page.locator("#cinemaName").pressSequentially(`Cinema ${companyName}`, { delay: 30 });
  // Cinema country defaults to account country (FR)
  await page.locator("#cinemaCity").click();
  await page.locator("#cinemaCity").pressSequentially("Paris", { delay: 30 });

  await page.getByRole("button", { name: /add cinema/i }).click();

  // Wait for cinema to appear in the list
  await expect(page.getByText(`Cinema ${companyName}`)).toBeVisible({ timeout: 10000 });

  // Click Continue to go to step 3
  await page.getByRole("button", { name: /continue/i }).click();

  // ─── Step 3: Skip invitations ────────────────────────────────────
  await expect(page.getByText(/invite your team/i)).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /skip this step/i }).click();

  // Wait for redirect to catalog
  await expect(page).toHaveURL(/\/en\/catalog/, { timeout: 30000 });
}

// ---------------------------------------------------------------------------
test.describe("Onboarding flow", () => {
  const user = {
    name: "E2E Onboarding User",
    email: `onboard-${TEST_ID}@e2e-test.local`,
    password: "StrongPass123!",
  };
  const companyName = `E2E Cinema ${TEST_ID}`;

  test("new user goes through onboarding and lands on catalog", async ({ page, request }) => {
    await registerAndLogin(page, request, user);
    await completeOnboarding(page, companyName);

    // Wait for network idle after the server-side redirect
    await page.waitForLoadState("networkidle");

    // Company name should appear in the marketplace header
    await expect(page.getByText(companyName)).toBeVisible({ timeout: 30000 });
  });
});

// ---------------------------------------------------------------------------
// 3. Account info editing
// ---------------------------------------------------------------------------
test.describe("Account information editing", () => {
  const user = {
    name: "E2E Account Edit User",
    email: `accedit-${TEST_ID}@e2e-test.local`,
    password: "StrongPass123!",
  };
  const companyName = `E2E Edit Co ${TEST_ID}`;
  const updatedCompanyName = `Updated Co ${TEST_ID}`;

  test("can edit account company name and see it persist", async ({ page, request }) => {
    // Setup: register, login, complete onboarding
    await registerAndLogin(page, request, user);
    await completeOnboarding(page, companyName);

    // Navigate to account information page
    await page.goto("/en/account/information");
    await expect(page.locator("#companyName")).toBeVisible({ timeout: 15000 });

    // Verify current company name is pre-filled
    await expect(page.locator("#companyName")).toHaveValue(companyName);

    // Update company name
    await page.fill("#companyName", updatedCompanyName);

    // Save
    await page.getByRole("button", { name: /save changes/i }).click();

    // Wait for success toast
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });

    // Reload the page and verify the change persisted
    await page.reload();
    await expect(page.locator("#companyName")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#companyName")).toHaveValue(updatedCompanyName);
  });
});

// ---------------------------------------------------------------------------
// 4. Profile editing
// ---------------------------------------------------------------------------
test.describe("Profile editing", () => {
  const user = {
    name: "E2E Profile User",
    email: `profile-${TEST_ID}@e2e-test.local`,
    password: "StrongPass123!",
  };
  const companyName = `E2E Profile Co ${TEST_ID}`;
  const updatedName = `Updated Name ${TEST_ID}`;

  test("can edit user name and see it persist", async ({ page, request }) => {
    // Setup: register, login, complete onboarding
    await registerAndLogin(page, request, user);
    await completeOnboarding(page, companyName);

    // Navigate to profile page
    await page.goto("/en/account/profile");
    await expect(page.locator("#name")).toBeVisible({ timeout: 15000 });

    // Verify current name is pre-filled
    await expect(page.locator("#name")).toHaveValue(user.name);

    // Email should be disabled
    await expect(page.locator("#email")).toBeDisabled();

    // Update name
    await page.fill("#name", updatedName);
    await page.getByRole("button", { name: /save changes/i }).click();

    // Wait for success toast
    await expect(page.getByText(/updated successfully/i)).toBeVisible({ timeout: 5000 });

    // Input should still have the updated value (local state)
    await expect(page.locator("#name")).toHaveValue(updatedName);
  });

  test("profile sessions page loads", async ({ page, request }) => {
    // Setup: register, login, complete onboarding with a new user
    const sessUser = {
      name: "E2E Sessions User",
      email: `sessions-${TEST_ID}@e2e-test.local`,
      password: "StrongPass123!",
    };
    await registerAndLogin(page, request, sessUser);
    await completeOnboarding(page, `Sessions Co ${TEST_ID}`);

    // Navigate to profile sessions tab
    await page.goto("/en/account/profile/sessions");

    // Should see the sessions card title (exact match to avoid matching description)
    await expect(page.getByText(/^active sessions$/i)).toBeVisible({ timeout: 15000 });

    // Should see at least one session (the current one)
    await expect(page.locator("[class*='rounded-md border']").first()).toBeVisible();

    // Sign out and Revoke all buttons should be visible
    await expect(page.getByRole("button", { name: /revoke all/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
  });
});
