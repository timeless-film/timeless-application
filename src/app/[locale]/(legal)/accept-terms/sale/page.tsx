import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/lib/auth";
import { getActiveAccountCookie, getAllMemberships } from "@/lib/auth/membership";
import {
  getPublishedDocument,
  hasAccountAcceptedCurrentTermsOfSale,
} from "@/lib/services/legal-service";

import { AcceptTermsOfSaleForm } from "./accept-sale-form";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.acceptSale");
  return { title: t("pageTitle") };
}

export default async function AcceptTermsOfSalePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const [activeCookie, memberships] = await Promise.all([
    getActiveAccountCookie(),
    getAllMemberships(session.user.id),
  ]);

  if (!activeCookie) redirect("/accounts");

  const activeMembership = memberships.find((m) => m.accountId === activeCookie.accountId);
  if (!activeMembership) redirect("/accounts");

  const country = activeMembership.account.country ?? "FR";

  // Check if already accepted
  const accepted = await hasAccountAcceptedCurrentTermsOfSale(activeCookie.accountId, country);
  if (accepted) redirect("/home");

  // Get the current published CGV
  const document = await getPublishedDocument("terms_of_sale", country);
  if (!document) redirect("/home");

  const canAccept = activeMembership.role === "owner" || activeMembership.role === "admin";

  return (
    <AcceptTermsOfSaleForm
      documentVersion={document.version}
      documentContent={document.content}
      accountId={activeCookie.accountId}
      country={country}
      canAccept={canAccept}
    />
  );
}
