import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { FilmForm } from "@/components/catalog/film-form";
import { auth } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/auth/membership";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("films.form");
  return {
    title: t("createTitle"),
  };
}

export default async function NewFilmPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const ctx = await getCurrentMembership();
  if (!ctx) return null;

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return null;
  }

  return <FilmForm mode="create" />;
}
