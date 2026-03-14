import { randomBytes } from "node:crypto";

import { expect } from "@playwright/test";
import postgres from "postgres";

import type { APIRequestContext, Page } from "@playwright/test";

const DB_URL =
  process.env.DATABASE_URL ?? "postgresql://timeless:timeless@localhost:5432/timeless_test";

const BASE_URL = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? 3099}`;

export interface AdminContext {
  email: string;
  password: string;
  userId: string;
  accountId: string;
}

export async function createAdminContext(
  request: APIRequestContext,
  testId: string,
  prefix: string
): Promise<AdminContext> {
  const uniqueSuffix = randomBytes(4).toString("hex");
  const email = `${prefix}-${testId}-${uniqueSuffix}@e2e-test.local`;
  const password = "StrongPass123!";

  const signupRes = await request.post("/api/auth/sign-up/email", {
    data: { name: `Admin ${prefix}`, email, password },
    headers: { "Content-Type": "application/json" },
  });
  expect(signupRes.ok()).toBeTruthy();

  const sql = postgres(DB_URL, { max: 1 });

  await sql`UPDATE better_auth_users SET email_verified = true WHERE email = ${email}`;

  const users = await sql`SELECT id FROM better_auth_users WHERE email = ${email}`;
  const userId = users[0]?.id as string | undefined;
  if (!userId) {
    await sql.end();
    throw new Error("Failed to retrieve created user id for admin E2E setup.");
  }

  const accounts = await sql`
    INSERT INTO accounts (type, company_name, country, onboarding_completed)
    VALUES ('admin', ${`Admin ${prefix} ${testId}`}, 'FR', true)
    RETURNING id
  `;
  const accountId = accounts[0]?.id as string | undefined;
  if (!accountId) {
    await sql.end();
    throw new Error("Failed to create admin account for E2E setup.");
  }

  await sql`
    INSERT INTO account_members (account_id, user_id, role)
    VALUES (${accountId}, ${userId}, 'owner')
  `;

  await sql.end();

  return { email, password, userId, accountId };
}

export async function loginAsAdmin(page: Page, context: AdminContext) {
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
      value: `${context.accountId}:admin`,
      url: BASE_URL,
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/en/login");
  await expect(page).toHaveURL(/\/en\//, { timeout: 15000 });
  await page.goto("/en/admin/dashboard");
  await expect(page).toHaveURL(/\/en\/admin\/dashboard/, { timeout: 15000 });
}
