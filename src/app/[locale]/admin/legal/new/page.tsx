import { getTranslations } from "next-intl/server";

import { LegalDocumentForm } from "../legal-document-form";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.legal");
  return { title: t("createTitle") };
}

export default async function NewLegalDocumentPage() {
  const t = await getTranslations("admin.legal");

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("createTitle")}</h1>
      <LegalDocumentForm />
    </div>
  );
}
