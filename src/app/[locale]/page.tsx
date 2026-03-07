import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getHomePathForType } from "@/lib/auth/active-account-cookie";
import { getAllMemberships, getActiveAccountCookie } from "@/lib/auth/membership";

export default async function LocaleRootPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect(`/${locale}/login`);
  }

  // If active account cookie exists → redirect to the correct interface
  const activeAccount = await getActiveAccountCookie();
  if (activeAccount) {
    redirect(`/${locale}${getHomePathForType(activeAccount.type)}`);
  }

  // No cookie — check how many memberships the user has
  const memberships = await getAllMemberships(session.user.id);

  if (memberships.length === 0) {
    redirect(`/${locale}/no-account`);
  }

  // One or more memberships → redirect to the account selector
  // (the selector will auto-select if only one account)
  redirect(`/${locale}/select-account`);
}
