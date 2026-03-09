import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { auth } from "@/lib/auth";
import { ACTIVE_ACCOUNT_COOKIE, parseActiveAccountCookie } from "@/lib/auth/active-account-cookie";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { getFilmAnalytics } from "@/lib/services/analytics-service";

import { AnalyticsPageContent } from "./analytics-page-content";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("analytics");
  return {
    title: t("title"),
  };
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  // Get session + active account
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const cookieStore = await cookies();
  const activeAccountCookie = cookieStore.get(ACTIVE_ACCOUNT_COOKIE);

  if (!activeAccountCookie) {
    throw new Error("No active account");
  }

  const parsed = parseActiveAccountCookie(activeAccountCookie.value);
  if (!parsed) {
    throw new Error("Invalid active account cookie");
  }

  // Verify account is rights holder
  const [account] = await db
    .select({ type: accounts.type })
    .from(accounts)
    .where(eq(accounts.id, parsed.accountId))
    .limit(1);

  if (!account || account.type !== "rights_holder") {
    throw new Error("Forbidden: only rights holders can access analytics");
  }

  const accountId = parsed.accountId;

  const analytics = await getFilmAnalytics(
    accountId,
    { period: "30days" },
    { page: 1, limit: 20 },
    { field: "views", order: "desc" }
  );

  return <AnalyticsPageContent accountId={accountId} initialData={analytics} />;
}
