import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("films");
  return {
    title: t("title"),
  };
}

export default async function FilmsPage() {
  const t = await getTranslations("films");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
    </div>
  );
}
