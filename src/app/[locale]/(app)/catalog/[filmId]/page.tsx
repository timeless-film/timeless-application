import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { ACTIVE_ACCOUNT_COOKIE, parseActiveAccountCookie } from "@/lib/auth/active-account-cookie";
import { db } from "@/lib/db";
import { getFilmForExhibitor } from "@/lib/services/catalog-service";
import { listCinemasForAccount } from "@/lib/services/cinema-service";

import { FilmDetailContent } from "./film-detail-content";

import type { Metadata } from "next";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ filmId: string }>;
}): Promise<Metadata> {
  const { filmId } = await params;

  // Get session + active account to fetch film
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { title: "Film" };
  }

  const cookieStore = await cookies();
  const activeAccountCookie = cookieStore.get(ACTIVE_ACCOUNT_COOKIE);

  if (!activeAccountCookie) {
    return { title: "Film" };
  }

  const parsed = parseActiveAccountCookie(activeAccountCookie.value);
  if (!parsed) {
    return { title: "Film" };
  }

  try {
    const film = await getFilmForExhibitor(filmId, parsed.accountId);
    if (!film) {
      return { title: "Film non trouvé" };
    }

    return {
      title: film.title,
      description: film.synopsis || undefined,
    };
  } catch {
    return { title: "Film" };
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────

interface FilmDetailPageProps {
  params: Promise<{ filmId: string }>;
}

export default async function FilmDetailPage({ params }: FilmDetailPageProps) {
  // Get session + active account
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const cookieStore = await cookies();
  const activeAccountCookie = cookieStore.get(ACTIVE_ACCOUNT_COOKIE);

  if (!activeAccountCookie) {
    throw new Error("No active account");
  }

  const parsed = parseActiveAccountCookie(activeAccountCookie.value);
  if (!parsed) {
    throw new Error("Invalid active account cookie");
  }

  const accountId = parsed.accountId;
  const { filmId } = await params;

  const account = await db.query.accounts.findFirst({
    where: (a, { eq }) => eq(a.id, accountId),
    columns: { preferredCurrency: true },
  });

  // Fetch film data (server-side)
  const film = await getFilmForExhibitor(filmId, accountId);

  if (!film) {
    notFound();
  }

  const cinemas = await listCinemasForAccount(accountId);
  const modalCinemas = cinemas.map((cinema) => ({
    id: cinema.id,
    name: cinema.name,
    rooms: cinema.rooms.map((room) => ({
      id: room.id,
      name: room.name,
    })),
  }));

  return (
    <FilmDetailContent
      film={film}
      accountId={accountId}
      cinemas={modalCinemas}
      preferredCurrency={account?.preferredCurrency ?? "EUR"}
    />
  );
}
