import { getTranslations } from "next-intl/server";

import { getAllSections } from "@/lib/services/editorial-service";

import { EditorialSectionList } from "./editorial-section-list";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.editorial");
  return { title: t("title") };
}

export default async function EditorialPage() {
  const t = await getTranslations("admin.editorial");
  const sections = await getAllSections();

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <EditorialSectionList initialSections={sections} />
    </div>
  );
}
