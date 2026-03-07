import { getTranslations } from "next-intl/server";

import { AcceptInvitationResult } from "./accept-invitation-result";
import { acceptInvitation } from "../account/members/invitation-actions";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("acceptInvitation");
  return {
    title: t("title"),
  };
}

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <AcceptInvitationResult status="error" errorKey="INVALID_TOKEN" />;
  }

  const result = await acceptInvitation(token);

  if (result.error) {
    return <AcceptInvitationResult status="error" errorKey={result.error} />;
  }

  return <AcceptInvitationResult status="success" />;
}
