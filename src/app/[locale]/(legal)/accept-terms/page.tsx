import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { auth } from "@/lib/auth";
import { getPublishedDocument, hasUserAcceptedCurrentTerms } from "@/lib/services/legal-service";

import { AcceptTermsForm } from "./accept-terms-form";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.acceptTerms");
  return { title: t("pageTitle") };
}

export default async function AcceptTermsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  // If the user has already accepted the current CGU, redirect to home
  const accepted = await hasUserAcceptedCurrentTerms(session.user.id);
  if (accepted) redirect("/home");

  // Get the current published CGU
  const document = await getPublishedDocument("terms_of_service");
  if (!document) redirect("/home"); // No CGU published, nothing to accept

  return <AcceptTermsForm documentVersion={document.version} documentContent={document.content} />;
}
