import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FilmForm } from "@/components/catalog/film-form";
import { FilmSalesSection } from "@/components/wallet/film-sales-section";
import { auth } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/auth/membership";
import { getFilmById } from "@/lib/services/film-service";

import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ filmId: string }>;
}): Promise<Metadata> {
  const { filmId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return {};

  const ctx = await getCurrentMembership();
  if (!ctx) return {};

  const result = await getFilmById(filmId, ctx.accountId);
  if ("error" in result) return {};

  return {
    title: result.film.title,
  };
}

export default async function EditFilmPage({ params }: { params: Promise<{ filmId: string }> }) {
  const { filmId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const ctx = await getCurrentMembership();
  if (!ctx) return null;

  const result = await getFilmById(filmId, ctx.accountId);
  if ("error" in result) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <FilmForm mode="edit" film={result.film} />
      <Suspense>
        <FilmSalesSection accountId={ctx.accountId} filmId={filmId} />
      </Suspense>
    </div>
  );
}
