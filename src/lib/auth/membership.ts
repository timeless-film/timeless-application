import { cookies, headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

import { ACTIVE_ACCOUNT_COOKIE, parseActiveAccountCookie } from "./active-account-cookie";

import type { ActiveAccountCookie } from "./active-account-cookie";

/**
 * Read the active account cookie (server components & server actions).
 */
export async function getActiveAccountCookie(): Promise<ActiveAccountCookie | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(ACTIVE_ACCOUNT_COOKIE);
  if (!cookie?.value) return null;
  return parseActiveAccountCookie(cookie.value);
}

/**
 * Get the current membership based on the active account cookie.
 * Returns null if no cookie, no session, or if the user is no longer a member.
 */
export async function getCurrentMembership() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const activeCookie = await getActiveAccountCookie();
  if (!activeCookie) return null;

  const membership = await db.query.accountMembers.findFirst({
    where: (am, { eq, and }) =>
      and(eq(am.userId, session.user.id), eq(am.accountId, activeCookie.accountId)),
    with: { account: true },
  });

  if (!membership) return null;

  return { ...membership, session };
}

/**
 * Get all memberships for a user (with account details).
 */
export async function getAllMemberships(userId: string) {
  return db.query.accountMembers.findMany({
    where: (am, { eq }) => eq(am.userId, userId),
    with: { account: true },
    orderBy: (am, { asc }) => asc(am.createdAt),
  });
}
