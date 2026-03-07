import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getActiveAccountCookie, getAllMemberships } from "@/lib/auth/membership";

import { AccountsManager } from "./accounts-manager";

export default async function AccountsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [memberships, activeCookie] = await Promise.all([
    getAllMemberships(session.user.id),
    getActiveAccountCookie(),
  ]);

  return (
    <AccountsManager memberships={memberships} activeAccountId={activeCookie?.accountId ?? null} />
  );
}
