"use server";

import { cookies, headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

import {
  ACTIVE_ACCOUNT_COOKIE,
  encodeActiveAccountCookie,
  getHomePathForType,
} from "./active-account-cookie";

/**
 * Switch the active account. Sets the HttpOnly cookie and returns the redirect URL.
 * Called from client components (AccountSwitcher, AccountSelector).
 */
export async function switchAccount(accountId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  // Verify the user is actually a member of this account
  const membership = await db.query.accountMembers.findFirst({
    where: (am, { eq, and }) => and(eq(am.userId, session.user.id), eq(am.accountId, accountId)),
    with: { account: true },
  });

  if (!membership) return { error: "NOT_MEMBER" as const };

  // Set the HttpOnly cookie
  const cookieStore = await cookies();
  cookieStore.set(
    ACTIVE_ACCOUNT_COOKIE,
    encodeActiveAccountCookie(accountId, membership.account.type),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    }
  );

  return {
    success: true as const,
    redirectUrl: getHomePathForType(membership.account.type),
    accountName: membership.account.companyName,
  };
}

/**
 * Clear the active account cookie.
 */
export async function clearActiveAccount() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ACCOUNT_COOKIE);
}
