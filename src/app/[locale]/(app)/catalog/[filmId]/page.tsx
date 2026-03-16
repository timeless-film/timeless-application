import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { ACTIVE_ACCOUNT_COOKIE, parseActiveAccountCookie } from "@/lib/auth/active-account-cookie";
import { db } from "@/lib/db";
import { filmCompanies, filmGenres, filmPeople, genres as genresTable } from "@/lib/db/schema";
import { getFilmRequestsSummary } from "@/lib/services/booking-service";
import { getFilmForExhibitor } from "@/lib/services/catalog-service";
import { listCinemasForAccount } from "@/lib/services/cinema-service";
import { trackFilmEvent } from "@/lib/services/film-event-service";

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

  // Track film view (fire-and-forget — don't block rendering)
  trackFilmEvent(filmId, accountId, "view");

  // Fetch normalized TMDB data + cinemas + request summary in parallel
  const [people, genres, companies, cinemas, requestSummary] = await Promise.all([
    db
      .select({
        name: filmPeople.name,
        role: filmPeople.role,
        character: filmPeople.character,
        profileUrl: filmPeople.profileUrl,
        displayOrder: filmPeople.displayOrder,
      })
      .from(filmPeople)
      .where(eq(filmPeople.filmId, filmId))
      .orderBy(filmPeople.displayOrder),
    db
      .select({
        nameEn: genresTable.nameEn,
        nameFr: genresTable.nameFr,
      })
      .from(filmGenres)
      .innerJoin(genresTable, eq(filmGenres.genreId, genresTable.id))
      .where(eq(filmGenres.filmId, filmId)),
    db
      .select({
        name: filmCompanies.name,
        logoUrl: filmCompanies.logoUrl,
        originCountry: filmCompanies.originCountry,
      })
      .from(filmCompanies)
      .where(eq(filmCompanies.filmId, filmId)),
    listCinemasForAccount(accountId),
    getFilmRequestsSummary({
      exhibitorAccountId: accountId,
      filmId,
    }),
  ]);
  const modalCinemas = cinemas.map((cinema) => ({
    id: cinema.id,
    name: cinema.name,
    country: cinema.country,
    rooms: cinema.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      capacity: room.capacity,
    })),
  }));

  return (
    <FilmDetailContent
      film={film}
      accountId={accountId}
      cinemas={modalCinemas}
      existingRequests={requestSummary.map((item) => ({
        id: item.id,
        status: item.status,
        cinemaName: item.cinema.name,
        roomName: item.room.name,
      }))}
      preferredCurrency={account?.preferredCurrency ?? "EUR"}
      people={people}
      genres={genres}
      companies={companies}
    />
  );
}
