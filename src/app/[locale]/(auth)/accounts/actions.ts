"use server";

import { cookies, headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  ACTIVE_ACCOUNT_COOKIE,
  encodeActiveAccountCookie,
  getHomePathForType,
} from "@/lib/auth/active-account-cookie";
import { identifyUser } from "@/lib/customerio";
import { db } from "@/lib/db";
import { accountMembers, accounts } from "@/lib/db/schema";

import type { AccountType } from "@/lib/auth/active-account-cookie";

interface CreateAccountInput {
  companyName: string;
  country: string;
  type: AccountType;
}

export async function createAccount(input: CreateAccountInput) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "UNAUTHORIZED" as const };
  }

  // Only exhibitor accounts can be self-created (rights_holder/admin are created by admins)
  if (input.type !== "exhibitor") {
    return { error: "FORBIDDEN" as const };
  }

  // Create the account
  const [account] = await db
    .insert(accounts)
    .values({
      type: input.type,
      companyName: input.companyName,
      country: input.country,
    })
    .returning();

  if (!account) {
    return { error: "CREATION_FAILED" as const };
  }

  // Link user as owner
  await db.insert(accountMembers).values({
    accountId: account.id,
    userId: session.user.id,
    role: "owner",
  });

  // Set the active account cookie to the new account
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ACCOUNT_COOKIE, encodeActiveAccountCookie(account.id, input.type), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Identify user in Customer.io
  await identifyUser({
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    accountType: input.type,
    accountId: account.id,
    country: input.country,
  });

  return {
    success: true as const,
    accountId: account.id,
    redirectUrl: getHomePathForType(input.type),
    accountName: input.companyName,
  };
}
