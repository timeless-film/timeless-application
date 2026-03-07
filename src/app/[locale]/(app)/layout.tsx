import { headers } from "next/headers";

import { MarketplaceHeader } from "@/components/marketplace-header";
import { auth } from "@/lib/auth";
import { getActiveAccountCookie, getAllMemberships } from "@/lib/auth/membership";

import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  const user = {
    name: session?.user.name ?? "",
    email: session?.user.email ?? "",
  };

  const [memberships, activeCookie] = await Promise.all([
    session ? getAllMemberships(session.user.id) : [],
    getActiveAccountCookie(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <MarketplaceHeader
        user={user}
        memberships={memberships}
        activeAccountId={activeCookie?.accountId ?? ""}
      />
      <main className="flex-1">{children}</main>
      <footer className="border-t bg-muted/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 text-sm text-muted-foreground lg:px-6">
          <p>&copy; {new Date().getFullYear()} Timeless Cinema</p>
        </div>
      </footer>
    </div>
  );
}
