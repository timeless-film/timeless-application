import { getTranslations } from "next-intl/server";

import { FilmList } from "@/components/admin/film-list";
import { listFilmsForAdmin } from "@/lib/services/admin-films-service";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.films");
  return {
    title: t("title"),
  };
}

export default async function AdminFilmsPage() {
  const t = await getTranslations("admin.films");

  const { films, total } = await listFilmsForAdmin({
    page: 1,
    limit: 20,
  });

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("title")}</h1>
      <FilmList initialFilms={films} initialTotal={total} />
    </div>
  );
}
