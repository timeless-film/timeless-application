import { createHash, randomBytes } from "node:crypto";

import { expect } from "@playwright/test";
import postgres from "postgres";

import type { APIRequestContext, Page } from "@playwright/test";

const DB_URL =
  process.env.DATABASE_URL ?? "postgresql://timeless:timeless@localhost:5432/timeless_test";

const BASE_URL = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? 3099}`;

export interface RightsHolderContext {
  email: string;
  password: string;
  userId: string;
  accountId: string;
  bearerToken: string;
}

export async function createRightsHolderContext(
  request: APIRequestContext,
  testId: string,
  prefix: string
): Promise<RightsHolderContext> {
  const uniqueSuffix = randomBytes(4).toString("hex");
  const email = `${prefix}-${testId}-${uniqueSuffix}@e2e-test.local`;
  const password = "StrongPass123!";

  const signupRes = await request.post("/api/auth/sign-up/email", {
    data: { name: `RH ${prefix}`, email, password },
    headers: { "Content-Type": "application/json" },
  });
  expect(signupRes.ok()).toBeTruthy();

  const sql = postgres(DB_URL, { max: 1 });

  await sql`UPDATE better_auth_users SET email_verified = true WHERE email = ${email}`;

  const users = await sql`SELECT id FROM better_auth_users WHERE email = ${email}`;
  const userId = users[0]?.id as string | undefined;
  if (!userId) {
    await sql.end();
    throw new Error("Failed to retrieve created user id for E2E setup.");
  }

  const accounts = await sql`
    INSERT INTO accounts (type, company_name, country, onboarding_completed)
    VALUES ('rights_holder', ${`RH ${prefix} ${testId}`}, 'FR', true)
    RETURNING id
  `;
  const accountId = accounts[0]?.id as string | undefined;
  if (!accountId) {
    await sql.end();
    throw new Error("Failed to create rights holder account for E2E setup.");
  }

  await sql`
    INSERT INTO account_members (account_id, user_id, role)
    VALUES (${accountId}, ${userId}, 'owner')
  `;

  const rawToken = `tmls_${randomBytes(20).toString("hex")}`;
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const tokenPrefix = rawToken.substring(0, 13);

  await sql`
    INSERT INTO api_tokens (account_id, name, token_hash, token_prefix)
    VALUES (${accountId}, ${`RH E2E Token ${testId}`}, ${tokenHash}, ${tokenPrefix})
  `;

  await sql.end();

  return {
    email,
    password,
    userId,
    accountId,
    bearerToken: rawToken,
  };
}

export async function loginAsRightsHolder(page: Page, context: RightsHolderContext) {
  const signInRes = await page.request.post("/api/auth/sign-in/email", {
    data: {
      email: context.email,
      password: context.password,
    },
    headers: { "Content-Type": "application/json" },
  });

  expect(signInRes.ok()).toBeTruthy();

  await page.context().addCookies([
    {
      name: "active_account_id",
      value: `${context.accountId}:rights_holder`,
      url: BASE_URL,
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  // Force a navigation after cookie injection so server guards use the RH active account.
  // Navigate to login first to establish page context (avoids empty URL on fresh pages),
  // then to home which will be the authenticated landing page.
  await page.goto("/en/login");
  await expect(page).toHaveURL(/\/en\//, { timeout: 15000 });

  await page.goto("/en/home");
  await expect(page).toHaveURL(/\/en\//, { timeout: 15000 });
}

/**
 * E2E Stripe Connect test account for wallet tests.
 * NEVER delete this account in Stripe Dashboard.
 */
const STRIPE_TEST_CONNECT_ACCOUNT_ID = "acct_1T9Xa2Fg5bm7UN8b";

/**
 * Creates a rights holder E2E context with Stripe Connect account attached.
 * Used for wallet/payout E2E tests that need a real Stripe Connect account.
 */
export async function createRightsHolderWithStripeAccount(
  request: APIRequestContext,
  testId: string,
  prefix: string
): Promise<RightsHolderContext> {
  const ctx = await createRightsHolderContext(request, testId, prefix);

  const sql = postgres(DB_URL, { max: 1 });

  await sql`
    UPDATE accounts
    SET stripe_connect_account_id = ${STRIPE_TEST_CONNECT_ACCOUNT_ID},
        stripe_connect_onboarding_complete = true
    WHERE id = ${ctx.accountId}
  `;

  await sql.end();

  return ctx;
}
