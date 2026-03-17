import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { listLegalDocuments } from "@/lib/services/legal-service";

import { LegalDocumentList } from "./legal-document-list";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.legal");
  return { title: t("title") };
}

export default async function AdminLegalPage() {
  const t = await getTranslations("admin.legal");
  const documents = await listLegalDocuments();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">{t("title")}</h1>
        <Link
          href="/admin/legal/acceptances"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t("acceptances.title")} →
        </Link>
      </div>
      <LegalDocumentList initialDocuments={documents} />
    </div>
  );
}
