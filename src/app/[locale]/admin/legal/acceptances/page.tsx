import { getTranslations } from "next-intl/server";

import { listAcceptances, listLegalDocuments } from "@/lib/services/legal-service";

import { AcceptancesList } from "./acceptances-list";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.legal.acceptances");
  return { title: t("title") };
}

export default async function AcceptancesPage() {
  const t = await getTranslations("admin.legal.acceptances");

  const [acceptancesResult, documents] = await Promise.all([
    listAcceptances({ page: 1, limit: 20 }),
    listLegalDocuments(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <AcceptancesList
        initialItems={acceptancesResult.items}
        initialPagination={acceptancesResult.pagination}
        documents={documents}
      />
    </div>
  );
}
