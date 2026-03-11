import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { accountMembers } from "@/lib/db/schema";

export interface AccountUserInfo {
  userId: string;
  email: string;
  name: string;
  preferredLocale: string;
}

/**
 * Get all users (owner, admin, member) of an account with their email and locale.
 * Used to send emails to all members of an account.
 */
export async function getAccountUserEmails(accountId: string): Promise<AccountUserInfo[]> {
  const members = await db.query.accountMembers.findMany({
    where: eq(accountMembers.accountId, accountId),
    with: {
      user: {
        columns: {
          id: true,
          email: true,
          name: true,
          preferredLocale: true,
        },
      },
    },
  });

  return members.map((member) => ({
    userId: member.userId,
    email: member.user.email,
    name: member.user.name,
    preferredLocale: member.user.preferredLocale ?? "en",
  }));
}
