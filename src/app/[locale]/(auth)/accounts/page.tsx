import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getMyPendingInvitations } from "@/components/account/actions";
import { PendingInvitations } from "@/components/account/pending-invitations";
import { auth } from "@/lib/auth";
import { getActiveAccountCookie, getAllMemberships } from "@/lib/auth/membership";

import { AccountsManager } from "./accounts-manager";

import type { PendingInvitationInfo } from "@/components/account/pending-invitations";

export default async function AccountsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [memberships, activeCookie, invitationsResult] = await Promise.all([
    getAllMemberships(session.user.id),
    getActiveAccountCookie(),
    getMyPendingInvitations(),
  ]);

  if (memberships.length === 0) {
    redirect("/no-account");
  }

  const pendingInvitations: PendingInvitationInfo[] = (invitationsResult.invitations ?? []).map(
    (inv) => ({
      ...inv,
      expiresAt: new Date(inv.expiresAt),
    })
  );

  return (
    <div className="flex flex-col items-center gap-6">
      {pendingInvitations.length > 0 && <PendingInvitations invitations={pendingInvitations} />}
      <AccountsManager
        memberships={memberships}
        activeAccountId={activeCookie?.accountId ?? null}
      />
    </div>
  );
}
