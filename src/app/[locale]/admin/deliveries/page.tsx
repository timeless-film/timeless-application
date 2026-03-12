import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.deliveries");
  return {
    title: t("title"),
  };
}

export default async function DeliveriesPage() {
  const t = await getTranslations("admin.deliveries");

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("title")}</h1>
    </div>
  );
}
