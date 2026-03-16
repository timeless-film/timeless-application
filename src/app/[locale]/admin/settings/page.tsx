import { getTranslations } from "next-intl/server";

import { db } from "@/lib/db";
import { getPlatformPricingSettings } from "@/lib/pricing";
import { listGenres } from "@/lib/services/film-service";

import { GenreSeedCard } from "./genre-seed-card";
import { PlatformSettingsForm } from "./platform-settings-form";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.settings");
  return {
    title: t("title"),
  };
}

export default async function SettingsPage() {
  const t = await getTranslations("admin.settings");

  const [settings, history, allGenres] = await Promise.all([
    getPlatformPricingSettings(),
    db.query.platformSettingsHistory.findMany({
      orderBy: (h, { desc }) => desc(h.changedAt),
      limit: 50,
    }),
    listGenres(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("title")}</h1>
      <GenreSeedCard initialTotal={allGenres.length} />
      <PlatformSettingsForm initialSettings={settings} initialHistory={history} />
    </div>
  );
}
