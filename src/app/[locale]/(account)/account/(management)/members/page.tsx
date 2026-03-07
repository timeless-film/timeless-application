import { getTranslations } from "next-intl/server";

import { getMembers, getPendingInvitations } from "@/components/account/actions";
import { InviteSection } from "@/components/account/invite-section";
import { MembersList } from "@/components/account/members-list";

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
    <div className="space-y-6">
      <MembersList
        initialMembers={membersResult.members ?? []}
        initialCurrentUserRole={membersResult.currentUserRole}
      />
      <InviteSection initialInvitations={invitationsResult.invitations ?? []} />
    </div>
  );
}
