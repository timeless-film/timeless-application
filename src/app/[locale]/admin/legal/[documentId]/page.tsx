import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getLegalDocumentById } from "@/lib/services/legal-service";

import { LegalDocumentForm } from "../legal-document-form";

import type { Metadata } from "next";

interface DocumentPageProps {
  params: Promise<{ documentId: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.legal");
  return { title: t("editTitle") };
}

export default async function EditLegalDocumentPage({ params }: DocumentPageProps) {
  const { documentId } = await params;
  const t = await getTranslations("admin.legal");

  const document = await getLegalDocumentById(documentId);
  if (!document) notFound();

  const isDraft = document.status === "draft";

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{isDraft ? t("editTitle") : t("viewTitle")}</h1>
      <LegalDocumentForm document={document} readOnly={!isDraft} />
    </div>
  );
}
