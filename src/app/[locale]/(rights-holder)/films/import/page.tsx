import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { ImportWizard } from "@/components/catalog/import-wizard";
import { auth } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/auth/membership";
import { listAllFilmsForAccount } from "@/lib/services/film-service";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("films.import");
  return {
    title: t("title"),
  };
}

export default async function ImportFilmsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const ctx = await getCurrentMembership();
  if (!ctx) return null;

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return null;
  }

  const films = await listAllFilmsForAccount(ctx.accountId);

  const existingFilms = films.map((f) => ({
    id: f.id,
    title: f.title,
    externalId: f.externalId,
    status: f.status as "active" | "inactive" | "retired",
  }));

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden">
      <ImportWizard existingFilms={existingFilms} />
    </div>
  );
}
