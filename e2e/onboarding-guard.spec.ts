import { expect, test } from "@playwright/test";
import postgres from "postgres";

import type { APIRequestContext, Page } from "@playwright/test";

const TEST_ID = Date.now().toString(36);

const DB_URL =
  process.env.DATABASE_URL ?? "postgresql://timeless:timeless@localhost:5432/timeless_test";

/**
 * Register a user via API, verify email in DB, log in via UI.
 */
async function registerAndLogin(
  page: Page,
  request: APIRequestContext,
  user: { name: string; email: string; password: string },
) {
  const signupRes = await signUpWithRetry(request, user);
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

/**
 * Better Auth endpoint can return a transient 404 on first cold request in dev.
 * Retry once to reduce E2E flakiness.
 */
async function signUpWithRetry(
  request: APIRequestContext,
  user: { name: string; email: string; password: string },
) {
  const doSignUp = async () =>
    request.post("/api/auth/sign-up/email", {
      data: {
        name: user.name,
        email: user.email,
        password: user.password,
      },
      headers: { "Content-Type": "application/json" },
    });

  const firstAttempt = await doSignUp();
  if (firstAttempt.ok()) return firstAttempt;

  // Warm up auth session endpoint then retry once.
  await request.get("/api/auth/get-session");
  return doSignUp();
}

/**
 * Create an account + membership directly in DB for a user,
 * with onboardingCompleted = false.
 */
async function createAccountInDb(userId: string, companyName: string) {
  const sql = postgres(DB_URL, { max: 1 });
  const rows = await sql`
    INSERT INTO accounts (type, company_name, country, onboarding_completed)
    VALUES ('exhibitor', ${companyName}, 'FR', false)
    RETURNING id
  `;
  const accountId = rows[0]!.id as string;
  await sql`
    INSERT INTO account_members (account_id, user_id, role)
    VALUES (${accountId}, ${userId}, 'owner')
  `;
  await sql.end();
  return accountId;
}

/**
 * Get user ID from email.
 */
async function getUserId(email: string): Promise<string> {
  const sql = postgres(DB_URL, { max: 1 });
  const rows = await sql`SELECT id FROM better_auth_users WHERE email = ${email}`;
  await sql.end();
  return rows[0]!.id as string;
}

/**
 * Add a member to an existing account.
 */
async function addMemberToAccount(
  accountId: string,
  userId: string,
  role: string,
) {
  const sql = postgres(DB_URL, { max: 1 });
  await sql`
    INSERT INTO account_members (account_id, user_id, role)
    VALUES (${accountId}, ${userId}, ${role})
  `;
  await sql.end();
}

// ---------------------------------------------------------------------------
// Onboarding guard tests
// ---------------------------------------------------------------------------
test.describe("Onboarding guard", () => {
  test("redirects to /onboarding when exhibitor has not completed onboarding", async ({
    page,
    request,
  }) => {
    const companyName = `Guard Co ${TEST_ID}`;
    const user = {
      name: "Guard Test User",
      email: `guard-${TEST_ID}@e2e-test.local`,
      password: "StrongPass123!",
    };

    // Register and login
    await registerAndLogin(page, request, user);

    // User lands on /no-account — create an account with onboarding incomplete
    await expect(page).toHaveURL(/\/en\/no-account/, { timeout: 15000 });

    const userId = await getUserId(user.email);
    await createAccountInDb(userId, companyName);

    // No active account cookie is set when creating account directly in DB.
    // Visiting a protected route now redirects to /accounts where user picks an account.
    await page.goto("/en/catalog");
    await expect(page).toHaveURL(/\/en\/accounts/, { timeout: 15000 });
    await page.getByRole("button", { name: new RegExp(companyName, "i") }).click();

    // After account selection, exhibitor with incomplete onboarding is redirected.
    await expect(page).toHaveURL(/\/en\/onboarding/, { timeout: 15000 });
  });

  test("member of non-onboarded account sees blocked message", async ({
    page,
    request,
  }) => {
    // First, create owner who has an account
    const owner = {
      name: "Owner Guard User",
      email: `owner-guard-${TEST_ID}@e2e-test.local`,
      password: "StrongPass123!",
    };

    // Register owner via API only (don't need to login)
    const signupRes = await signUpWithRetry(request, owner);
    expect(signupRes.ok()).toBeTruthy();

    const sql = postgres(DB_URL, { max: 1 });
    await sql`UPDATE better_auth_users SET email_verified = true WHERE email = ${owner.email}`;
    await sql.end();

    const ownerId = await getUserId(owner.email);
    const accountId = await createAccountInDb(ownerId, `Member Blocked Co ${TEST_ID}`);

    // Register and login as member
    const member = {
      name: "Member Guard User",
      email: `member-guard-${TEST_ID}@e2e-test.local`,
      password: "StrongPass123!",
    };
    await registerAndLogin(page, request, member);

    // Member lands on /no-account
    await expect(page).toHaveURL(/\/en\/no-account/, { timeout: 15000 });

    // Add member to the non-onboarded account
    const memberId = await getUserId(member.email);
    await addMemberToAccount(accountId, memberId, "member");

    // Navigate to onboarding
    await page.goto("/en/onboarding");

    // Member should see blocked message
    await expect(page.getByText(/setup in progress/i)).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByText(/account administrator must complete the setup/i),
    ).toBeVisible();
  });
});
