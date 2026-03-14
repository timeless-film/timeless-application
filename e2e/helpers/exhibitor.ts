import { expect } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";

import type { APIRequestContext, Page } from "@playwright/test";

const DB_URL =
  process.env.DATABASE_URL ?? "postgresql://timeless:timeless@localhost:5432/timeless_test";

/**
 * Unique test ID scoped to the current process.
 * Used to avoid collisions between parallel test runs.
 */
const TEST_ID = Date.now().toString(36);

/**
 * Generate a unique email address for test isolation.
 * Uses crypto randomBytes for collision-free unique suffixes.
 */
export function uniqueEmail(prefix: string): string {
  const suffix = randomBytes(6).toString("hex");
  return `${prefix}-${TEST_ID}-${suffix}@e2e-test.local`;
}

/**
 * Register a user via Better Auth API, verify email directly in DB,
 * then log in through the UI.
 */
export async function registerAndLogin(
  page: Page,
  request: APIRequestContext,
  user: { name: string; email: string; password: string },
): Promise<void> {
  // Register via API
  const signupRes = await request.post("/api/auth/sign-up/email", {
    data: {
      name: user.name,
      email: user.email,
      password: user.password,
    },
    headers: { "Content-Type": "application/json" },
  });
  expect(signupRes.ok()).toBeTruthy();

  // Verify email directly in DB
  const sql = postgres(DB_URL, { max: 1 });
  await sql`UPDATE better_auth_users SET email_verified = true WHERE email = ${user.email}`;
  await sql.end();

  // Log in via UI
  await page.goto("/en/login");
  await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });
  await page.fill("input[type='email']", user.email);
  await page.fill("input[type='password']", user.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/^(?!.*\/login)/, { timeout: 15000 });
}

/**
 * Complete the 3-step exhibitor onboarding wizard:
 * 1. Company information (name + country + address + city + postal code)
 * 2. Add a cinema (name + city)
 * 3. Skip team invitations
 *
 * Expects the user to land on /no-account after login.
 */
export async function completeOnboarding(page: Page, companyName: string): Promise<void> {
  await expect(page).toHaveURL(/\/en\/no-account/, { timeout: 15000 });
  await page.getByRole("link", { name: /create an account/i }).click();
  await expect(page).toHaveURL(/\/en\/onboarding/, { timeout: 15000 });

  // Step 1: Company information
  await expect(page.locator("#companyName")).toBeVisible({ timeout: 15000 });
  await page.locator("#companyName").click();
  await page.locator("#companyName").pressSequentially(companyName, { delay: 30 });
  await page.locator("#address").click();
  await page.locator("#address").pressSequentially("1 Rue du Test", { delay: 30 });
  await page.locator("#city").click();
  await page.locator("#city").pressSequentially("Paris", { delay: 30 });
  await page.locator("#postalCode").click();
  await page.locator("#postalCode").pressSequentially("75001", { delay: 30 });
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 2: Add a cinema
  await expect(page.locator("#cinemaName")).toBeVisible({ timeout: 15000 });
  await page.locator("#cinemaName").click();
  await page.locator("#cinemaName").pressSequentially(`Cinema ${companyName}`, { delay: 30 });
  await page.locator("#cinemaCity").click();
  await page.locator("#cinemaCity").pressSequentially("Paris", { delay: 30 });
  await page.getByRole("button", { name: /add cinema/i }).click();
  await expect(page.getByText(`Cinema ${companyName}`)).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: /continue/i }).click();

  // Step 3: Skip invitations
  await expect(page.getByText(/invite your team/i)).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /skip this step/i }).click();
  await expect(page).toHaveURL(/\/en\/catalog/, { timeout: 30000 });
}

/**
 * Full setup: register, login, and complete onboarding for an exhibitor.
 * Returns the company name and cinema name for assertions.
 */
export async function setupExhibitor(
  page: Page,
  request: APIRequestContext,
  prefix: string,
): Promise<{ companyName: string; cinemaName: string }> {
  const email = uniqueEmail(prefix);
  const companyName = `${prefix} Co ${TEST_ID}`;
  const user = { name: `${prefix} User`, email, password: "StrongPass123!" };
  await registerAndLogin(page, request, user);
  await completeOnboarding(page, companyName);
  return { companyName, cinemaName: `Cinema ${companyName}` };
}

// ─── API-based exhibitor context (for admin E2E tests) ─────────────────────

export interface ExhibitorContext {
  email: string;
  password: string;
  userId: string;
  accountId: string;
}

/**
 * Create an exhibitor account directly via API + DB without UI.
 * Used by admin tests that need an exhibitor to appear in the list.
 */
export async function createExhibitorContext(
  request: APIRequestContext,
  testId: string,
  prefix: string
): Promise<ExhibitorContext> {
  const uniqueSuffix = randomBytes(4).toString("hex");
  const email = `${prefix}-${testId}-${uniqueSuffix}@e2e-test.local`;
  const password = "StrongPass123!";

  const signupRes = await request.post("/api/auth/sign-up/email", {
    data: { name: `Exh ${prefix}`, email, password },
    headers: { "Content-Type": "application/json" },
  });
  expect(signupRes.ok()).toBeTruthy();

  const sql = postgres(DB_URL, { max: 1 });

  await sql`UPDATE better_auth_users SET email_verified = true WHERE email = ${email}`;

  const users = await sql`SELECT id FROM better_auth_users WHERE email = ${email}`;
  const userId = users[0]?.id as string | undefined;
  if (!userId) {
    await sql.end();
    throw new Error("Failed to retrieve created user id for exhibitor E2E setup.");
  }

  const accountRows = await sql`
    INSERT INTO accounts (type, company_name, country, onboarding_completed)
    VALUES ('exhibitor', ${`Exh ${prefix} ${testId}`}, 'FR', true)
    RETURNING id
  `;
  const accountId = accountRows[0]?.id as string | undefined;
  if (!accountId) {
    await sql.end();
    throw new Error("Failed to create exhibitor account for E2E setup.");
  }

  await sql`
    INSERT INTO account_members (account_id, user_id, role)
    VALUES (${accountId}, ${userId}, 'owner')
  `;

  await sql.end();

  return { email, password, userId, accountId };
}
