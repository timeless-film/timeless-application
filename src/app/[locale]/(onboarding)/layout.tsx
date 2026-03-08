import { headers } from "next/headers";

import { AccountProvider } from "@/components/providers/account-provider";
import { auth } from "@/lib/auth";
import { getActiveAccountCookie, getAllMemberships } from "@/lib/auth/membership";

import type { ReactNode } from "react";

export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  const [memberships, activeCookie] = await Promise.all([
    session ? getAllMemberships(session.user.id) : [],
    getActiveAccountCookie(),
  ]);

  return (
    <AccountProvider
      key={activeCookie?.accountId ?? "no-account"}
      initialMemberships={memberships}
      initialActiveAccountId={activeCookie?.accountId ?? ""}
    >
      {children}
    </AccountProvider>
  );
}
