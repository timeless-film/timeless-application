import { getTranslations } from "next-intl/server";

import { getMembers } from "./actions";
import { getPendingInvitations } from "./invitation-actions";
import { InviteSection } from "./invite-section";
import { MembersList } from "./members-list";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("members");
  return {
    title: t("title"),
  };
}

export default async function MembersPage() {
  const [membersResult, invitationsResult] = await Promise.all([
    getMembers(),
    getPendingInvitations(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <MembersList
        initialMembers={membersResult.members ?? []}
        initialCurrentUserRole={membersResult.currentUserRole}
      />
      <InviteSection initialInvitations={invitationsResult.invitations ?? []} />
    </div>
  );
}
