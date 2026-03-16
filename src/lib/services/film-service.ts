import { and, count, eq, ilike, inArray, ne, or } from "drizzle-orm";

import { STRIPE_CURRENCY_CODES } from "@/lib/currencies";
import { db } from "@/lib/db";
import { filmCompanies, filmGenres, filmPeople, filmPrices, films, genres } from "@/lib/db/schema";

import type { CountryCode } from "@/lib/countries";
import type { NormalizedCompany, NormalizedPerson } from "@/lib/tmdb";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriceZoneInput {
  countries: string[];
  price: number; // In cents
  currency: string;
}

export interface CreateFilmInput {
  title: string;
  externalId?: string | null;
  type: "direct" | "validation";
  status?: "active" | "inactive";
  prices: PriceZoneInput[];
  // TMDB fields (set when a match was selected)
  tmdbId?: number | null;
  tmdbMatchStatus?: "matched" | "pending" | "no_match" | "manual";
  tmdbData?: unknown;
  originalTitle?: string | null;
  synopsis?: string | null;
  synopsisEn?: string | null;
  duration?: number | null;
  releaseYear?: number | null;
  genres?: string[] | null;
  directors?: string[] | null;
  cast?: string[] | null;
  countries?: string[] | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  tmdbRating?: string | null;
  tagline?: string | null;
  taglineEn?: string | null;
  // Import source
  importSource?: "manual" | "csv" | "excel";
  importBatchId?: string | null;
}

export interface UpdateFilmInput {
  title?: string;
  externalId?: string | null;
  type?: "direct" | "validation";
  status?: "active" | "inactive";
  prices?: PriceZoneInput[];
  // TMDB fields
  tmdbId?: number | null;
  tmdbMatchStatus?: "matched" | "pending" | "no_match" | "manual";
  tmdbData?: unknown;
  originalTitle?: string | null;
  synopsis?: string | null;
  synopsisEn?: string | null;
  duration?: number | null;
  releaseYear?: number | null;
  genres?: string[] | null;
  directors?: string[] | null;
  cast?: string[] | null;
  countries?: string[] | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  tmdbRating?: string | null;
  tagline?: string | null;
  taglineEn?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validatePriceZones(prices: PriceZoneInput[]) {
  if (prices.length === 0) {
    return { error: "NO_PRICE_ZONES" as const };
  }

  const seenCountries = new Set<string>();
  for (const zone of prices) {
    if (zone.countries.length === 0) {
      return { error: "EMPTY_COUNTRIES" as const };
    }
    if (zone.price <= 0 || !Number.isInteger(zone.price)) {
      return { error: "INVALID_PRICE" as const };
    }
    // SAFETY: STRIPE_CURRENCY_CODES is typed as readonly tuple, casting for .includes check
    if (!(STRIPE_CURRENCY_CODES as readonly string[]).includes(zone.currency.toUpperCase())) {
      return { error: "INVALID_CURRENCY" as const };
    }
    for (const country of zone.countries) {
      if (seenCountries.has(country)) {
        return { error: "DUPLICATE_COUNTRY" as const };
      }
      seenCountries.add(country);
    }
  }

  return null;
}

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listFilmsForAccount(accountId: string) {
  return db.query.films.findMany({
    where: and(eq(films.accountId, accountId), ne(films.status, "retired")),
    with: {
      prices: true,
    },
    orderBy: (f, { desc }) => desc(f.createdAt),
  });
}

/**
 * List all films for an account, including retired/archived ones.
 * Used by the import flow so archived films can be matched and restored.
 */
export async function listAllFilmsForAccount(accountId: string) {
  return db.query.films.findMany({
    where: eq(films.accountId, accountId),
    with: {
      prices: true,
    },
    orderBy: (f, { desc }) => desc(f.createdAt),
  });
}

// ─── List (paginated + search) ────────────────────────────────────────────────

interface ListFilmsPaginatedOptions {
  search?: string;
  page?: number;
  limit?: number;
}

export async function listFilmsForAccountPaginated(
  accountId: string,
  options?: ListFilmsPaginatedOptions
) {
  const { search, page = 1, limit = 5 } = options ?? {};
  const offset = (page - 1) * limit;

  const baseCondition = and(eq(films.accountId, accountId), ne(films.status, "retired"));

  const whereCondition = search?.trim()
    ? and(
        baseCondition,
        or(ilike(films.title, `%${search.trim()}%`), ilike(films.externalId, `%${search.trim()}%`))
      )
    : baseCondition;

  const [items, totalResult] = await Promise.all([
    db.query.films.findMany({
      where: whereCondition,
      with: { prices: true },
      orderBy: (f, { desc }) => desc(f.createdAt),
      limit,
      offset,
    }),
    db.select({ value: count() }).from(films).where(whereCondition),
  ]);

  return { films: items, total: totalResult[0]?.value ?? 0 };
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function getFilmById(filmId: string, accountId: string) {
  const film = await db.query.films.findFirst({
    where: and(eq(films.id, filmId), eq(films.accountId, accountId)),
    with: {
      prices: true,
    },
  });

  if (!film) {
    return { error: "NOT_FOUND" as const };
  }

  return { film };
}

// ─── Verify ownership ─────────────────────────────────────────────────────────

export async function verifyFilmOwnership(filmId: string, accountId: string) {
  const film = await db.query.films.findFirst({
    where: and(eq(films.id, filmId), eq(films.accountId, accountId), ne(films.status, "retired")),
  });
  return !!film;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createFilm(accountId: string, input: CreateFilmInput) {
  const validationError = validatePriceZones(input.prices);
  if (validationError) {
    return validationError;
  }

  const [film] = await db
    .insert(films)
    .values({
      accountId,
      title: input.title.trim(),
      externalId: input.externalId?.trim() || null,
      type: input.type,
      status: input.status ?? "active",
      tmdbId: input.tmdbId ?? null,
      tmdbMatchStatus: input.tmdbMatchStatus ?? "pending",
      tmdbData: input.tmdbData ?? null,
      originalTitle: input.originalTitle ?? null,
      synopsis: input.synopsis ?? null,
      synopsisEn: input.synopsisEn ?? null,
      duration: input.duration ?? null,
      releaseYear: input.releaseYear ?? null,
      genres: input.genres ?? null,
      directors: input.directors ?? null,
      cast: input.cast ?? null,
      countries: input.countries ?? null,
      posterUrl: input.posterUrl ?? null,
      backdropUrl: input.backdropUrl ?? null,
      tmdbRating: input.tmdbRating ?? null,
      importSource: input.importSource ?? "manual",
      importBatchId: input.importBatchId ?? null,
    })
    .returning();

  if (!film) {
    return { error: "CREATION_FAILED" as const };
  }

  // Insert price zones
  if (input.prices.length > 0) {
    await db.insert(filmPrices).values(
      input.prices.map((zone) => ({
        filmId: film.id,
        countries: zone.countries as CountryCode[],
        price: zone.price,
        currency: zone.currency.toUpperCase(),
      }))
    );
  }

  // Re-fetch with prices
  const result = await db.query.films.findFirst({
    where: eq(films.id, film.id),
    with: { prices: true },
  });

  return { film: result! };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateFilmById(filmId: string, accountId: string, input: UpdateFilmInput) {
  const existing = await db.query.films.findFirst({
    where: and(eq(films.id, filmId), eq(films.accountId, accountId)),
  });

  if (!existing) {
    return { error: "NOT_FOUND" as const };
  }

  if (existing.status === "retired") {
    return { error: "FILM_RETIRED" as const };
  }

  // Validate prices if provided
  if (input.prices) {
    const validationError = validatePriceZones(input.prices);
    if (validationError) {
      return validationError;
    }
  }

  const [updated] = await db
    .update(films)
    .set({
      ...(input.title !== undefined && { title: input.title.trim() }),
      ...(input.externalId !== undefined && { externalId: input.externalId?.trim() || null }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.tmdbId !== undefined && { tmdbId: input.tmdbId }),
      ...(input.tmdbMatchStatus !== undefined && { tmdbMatchStatus: input.tmdbMatchStatus }),
      ...(input.tmdbData !== undefined && { tmdbData: input.tmdbData }),
      ...(input.originalTitle !== undefined && { originalTitle: input.originalTitle }),
      ...(input.synopsis !== undefined && { synopsis: input.synopsis }),
      ...(input.synopsisEn !== undefined && { synopsisEn: input.synopsisEn }),
      ...(input.duration !== undefined && { duration: input.duration }),
      ...(input.releaseYear !== undefined && { releaseYear: input.releaseYear }),
      ...(input.genres !== undefined && { genres: input.genres }),
      ...(input.directors !== undefined && { directors: input.directors }),
      ...(input.cast !== undefined && { cast: input.cast }),
      ...(input.countries !== undefined && { countries: input.countries }),
      ...(input.posterUrl !== undefined && { posterUrl: input.posterUrl }),
      ...(input.backdropUrl !== undefined && { backdropUrl: input.backdropUrl }),
      ...(input.tmdbRating !== undefined && { tmdbRating: input.tmdbRating }),
      updatedAt: new Date(),
    })
    .where(eq(films.id, filmId))
    .returning();

  // Replace price zones if provided
  if (input.prices) {
    await db.delete(filmPrices).where(eq(filmPrices.filmId, filmId));
    if (input.prices.length > 0) {
      await db.insert(filmPrices).values(
        input.prices.map((zone) => ({
          filmId,
          countries: zone.countries as CountryCode[],
          price: zone.price,
          currency: zone.currency.toUpperCase(),
        }))
      );
    }
  }

  // Re-fetch with prices
  const result = await db.query.films.findFirst({
    where: eq(films.id, filmId),
    with: { prices: true },
  });

  return { film: result ?? updated };
}

interface ImportSyncFilmInput {
  title: string;
  externalId?: string | null;
  type: "direct" | "validation";
  status: "active" | "inactive";
  prices: PriceZoneInput[];
  synopsis?: string | null;
  synopsisEn?: string | null;
  duration?: number | null;
  releaseYear?: number | null;
  genres?: string[] | null;
  directors?: string[] | null;
  cast?: string[] | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  tmdbMatchStatus?: "matched" | "pending" | "no_match" | "manual";
  importSource?: "manual" | "csv" | "excel";
  importBatchId?: string | null;
}

/**
 * Import is source of truth: updates a film even if it is currently retired.
 */
export async function syncFilmFromImportById(
  filmId: string,
  accountId: string,
  input: ImportSyncFilmInput
) {
  const existing = await db.query.films.findFirst({
    where: and(eq(films.id, filmId), eq(films.accountId, accountId)),
  });

  if (!existing) {
    return { error: "NOT_FOUND" as const };
  }

  const validationError = validatePriceZones(input.prices);
  if (validationError) {
    return validationError;
  }

  const [updated] = await db
    .update(films)
    .set({
      title: input.title.trim(),
      externalId: input.externalId?.trim() || null,
      type: input.type,
      status: input.status,
      ...(input.synopsis !== undefined && { synopsis: input.synopsis }),
      ...(input.synopsisEn !== undefined && { synopsisEn: input.synopsisEn }),
      ...(input.duration !== undefined && { duration: input.duration }),
      ...(input.releaseYear !== undefined && { releaseYear: input.releaseYear }),
      ...(input.genres !== undefined && { genres: input.genres }),
      ...(input.directors !== undefined && { directors: input.directors }),
      ...(input.cast !== undefined && { cast: input.cast }),
      ...(input.posterUrl !== undefined && { posterUrl: input.posterUrl }),
      ...(input.backdropUrl !== undefined && { backdropUrl: input.backdropUrl }),
      ...(input.tmdbMatchStatus !== undefined && { tmdbMatchStatus: input.tmdbMatchStatus }),
      importSource: input.importSource ?? "csv",
      importBatchId: input.importBatchId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(films.id, filmId))
    .returning();

  await db.delete(filmPrices).where(eq(filmPrices.filmId, filmId));

  if (input.prices.length > 0) {
    await db.insert(filmPrices).values(
      input.prices.map((zone) => ({
        filmId,
        countries: zone.countries as CountryCode[],
        price: zone.price,
        currency: zone.currency.toUpperCase(),
      }))
    );
  }

  const result = await db.query.films.findFirst({
    where: eq(films.id, filmId),
    with: { prices: true },
  });

  return { film: result ?? updated };
}

// ─── Set Status ───────────────────────────────────────────────────────────────

export async function setFilmStatus(
  filmId: string,
  accountId: string,
  newStatus: "active" | "inactive" | "retired"
) {
  const film = await db.query.films.findFirst({
    where: and(eq(films.id, filmId), eq(films.accountId, accountId)),
  });

  if (!film) {
    return { error: "NOT_FOUND" as const };
  }

  if (film.status === "retired") {
    return { error: "ALREADY_RETIRED" as const };
  }

  const [updated] = await db
    .update(films)
    .set({
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(films.id, filmId))
    .returning();

  return { film: updated };
}

// ─── Archive ──────────────────────────────────────────────────────────────────

export async function archiveFilmById(filmId: string, accountId: string) {
  return setFilmStatus(filmId, accountId, "retired");
}

// ─── TMDB Relations Sync ──────────────────────────────────────────────────────

interface SyncFilmTmdbRelationsInput {
  genreIds: number[];
  people: NormalizedPerson[];
  companies: NormalizedCompany[];
}

/**
 * Resolves TMDB genre IDs to internal genre IDs.
 * Returns only IDs that have a matching tmdbId in the genres table.
 */
export async function resolveTmdbGenreIds(tmdbGenreIds: number[]): Promise<number[]> {
  if (tmdbGenreIds.length === 0) return [];

  const rows = await db
    .select({ id: genres.id, tmdbId: genres.tmdbId })
    .from(genres)
    .where(inArray(genres.tmdbId, tmdbGenreIds));

  return rows.map((r) => r.id);
}

/**
 * Syncs normalized TMDB relations for a film (genres, people, companies).
 * Deletes existing relations and re-inserts from fresh TMDB data.
 * Genre IDs in input are TMDB IDs — they are resolved to internal IDs automatically.
 */
export async function syncFilmTmdbRelations(filmId: string, input: SyncFilmTmdbRelationsInput) {
  // Resolve TMDB genre IDs to internal genre IDs
  const internalGenreIds = await resolveTmdbGenreIds(input.genreIds);

  await db.transaction(async (tx) => {
    // Clear existing relations
    await tx.delete(filmGenres).where(eq(filmGenres.filmId, filmId));
    await tx.delete(filmPeople).where(eq(filmPeople.filmId, filmId));
    await tx.delete(filmCompanies).where(eq(filmCompanies.filmId, filmId));

    // Insert genres (using internal IDs)
    if (internalGenreIds.length > 0) {
      await tx.insert(filmGenres).values(
        internalGenreIds.map((genreId) => ({
          filmId,
          genreId,
        }))
      );
    }

    // Insert people
    if (input.people.length > 0) {
      await tx.insert(filmPeople).values(
        input.people.map((person) => ({
          filmId,
          tmdbPersonId: person.tmdbPersonId,
          name: person.name,
          role: person.role,
          character: person.character,
          displayOrder: person.displayOrder,
          profileUrl: person.profileUrl,
        }))
      );
    }

    // Insert companies
    if (input.companies.length > 0) {
      await tx.insert(filmCompanies).values(
        input.companies.map((company) => ({
          filmId,
          tmdbCompanyId: company.tmdbCompanyId,
          name: company.name,
          logoUrl: company.logoUrl,
          originCountry: company.originCountry,
        }))
      );
    }
  });
}

// ─── Sync normalized relations from flat fields (manual / CSV data) ───────────

interface SyncNormalizedFromFlatFieldsInput {
  directors?: string[] | null;
  cast?: string[] | null;
  genreIds?: number[] | null;
}

/**
 * Syncs normalized relations from manually entered or CSV-imported data.
 * Unlike syncFilmTmdbRelations, this works with flat text fields and genre IDs
 * (not TMDB IDs for people). People are inserted with tmdbPersonId=null.
 *
 * Genre IDs are validated against the genres table before insertion.
 */
export async function syncNormalizedRelationsFromFlatFields(
  filmId: string,
  input: SyncNormalizedFromFlatFieldsInput
) {
  await db.transaction(async (tx) => {
    // Clear existing relations (people + genres only, not companies for manual data)
    await tx.delete(filmPeople).where(eq(filmPeople.filmId, filmId));
    await tx.delete(filmGenres).where(eq(filmGenres.filmId, filmId));

    // Insert directors
    const directors = input.directors?.filter(Boolean) ?? [];
    if (directors.length > 0) {
      await tx.insert(filmPeople).values(
        directors.map((name, index) => ({
          filmId,
          tmdbPersonId: null,
          name,
          role: "director" as const,
          character: null,
          displayOrder: index,
          profileUrl: null,
        }))
      );
    }

    // Insert cast
    const castMembers = input.cast?.filter(Boolean) ?? [];
    if (castMembers.length > 0) {
      await tx.insert(filmPeople).values(
        castMembers.map((name, index) => ({
          filmId,
          tmdbPersonId: null,
          name,
          role: "actor" as const,
          character: null,
          displayOrder: index,
          profileUrl: null,
        }))
      );
    }

    // Insert genres (validated against genres table)
    const genreIds = input.genreIds?.filter((id) => id > 0) ?? [];
    if (genreIds.length > 0) {
      // Validate genre IDs exist in the taxonomy
      const validGenres = await tx
        .select({ id: genres.id })
        .from(genres)
        .where(or(...genreIds.map((id) => eq(genres.id, id)))!);
      const validIds = new Set(validGenres.map((g) => g.id));

      const toInsert = genreIds.filter((id) => validIds.has(id));
      if (toInsert.length > 0) {
        await tx.insert(filmGenres).values(
          toInsert.map((genreId) => ({
            filmId,
            genreId,
          }))
        );
      }
    }
  });
}

// ─── Genre helpers ────────────────────────────────────────────────────────────

/**
 * Fetches localized genre objects for a batch of film IDs.
 * Returns a Map from filmId to an array of { nameEn, nameFr } genre objects.
 */
export async function getLocalizedGenresForFilms(
  filmIds: string[]
): Promise<Map<string, { nameEn: string; nameFr: string }[]>> {
  if (filmIds.length === 0) return new Map();

  const rows = await db
    .select({
      filmId: filmGenres.filmId,
      nameEn: genres.nameEn,
      nameFr: genres.nameFr,
    })
    .from(filmGenres)
    .innerJoin(genres, eq(filmGenres.genreId, genres.id))
    .where(inArray(filmGenres.filmId, filmIds));

  const map = new Map<string, { nameEn: string; nameFr: string }[]>();
  for (const row of rows) {
    const existing = map.get(row.filmId) ?? [];
    existing.push({ nameEn: row.nameEn, nameFr: row.nameFr });
    map.set(row.filmId, existing);
  }
  return map;
}

// ─── Canonical genre taxonomy ─────────────────────────────────────────────────

const CANONICAL_GENRES = [
  { tmdbId: 28, nameEn: "Action", nameFr: "Action" },
  { tmdbId: 12, nameEn: "Adventure", nameFr: "Aventure" },
  { tmdbId: 16, nameEn: "Animation", nameFr: "Animation" },
  { tmdbId: 35, nameEn: "Comedy", nameFr: "Comédie" },
  { tmdbId: 80, nameEn: "Crime", nameFr: "Crime" },
  { tmdbId: 99, nameEn: "Documentary", nameFr: "Documentaire" },
  { tmdbId: 18, nameEn: "Drama", nameFr: "Drame" },
  { tmdbId: 10751, nameEn: "Family", nameFr: "Familial" },
  { tmdbId: 14, nameEn: "Fantasy", nameFr: "Fantastique" },
  { tmdbId: 36, nameEn: "History", nameFr: "Histoire" },
  { tmdbId: 27, nameEn: "Horror", nameFr: "Horreur" },
  { tmdbId: 10402, nameEn: "Music", nameFr: "Musique" },
  { tmdbId: 9648, nameEn: "Mystery", nameFr: "Mystère" },
  { tmdbId: 10749, nameEn: "Romance", nameFr: "Romance" },
  { tmdbId: 878, nameEn: "Science Fiction", nameFr: "Science-Fiction" },
  { tmdbId: 10770, nameEn: "TV Movie", nameFr: "Téléfilm" },
  { tmdbId: 53, nameEn: "Thriller", nameFr: "Thriller" },
  { tmdbId: 10752, nameEn: "War", nameFr: "Guerre" },
  { tmdbId: 37, nameEn: "Western", nameFr: "Western" },
];

/**
 * Seeds missing genres from the canonical taxonomy.
 * Uses upsert on tmdbId — existing genres are updated (names), missing ones are inserted.
 * Returns the number of genres inserted.
 */
export async function seedMissingGenres(): Promise<{ inserted: number; total: number }> {
  const existing = await db.select({ tmdbId: genres.tmdbId }).from(genres);
  const existingTmdbIds = new Set(existing.map((g) => g.tmdbId));

  const missing = CANONICAL_GENRES.filter((g) => !existingTmdbIds.has(g.tmdbId));

  if (missing.length > 0) {
    await db.insert(genres).values(missing);
  }

  const total = await db.select({ id: genres.id }).from(genres);

  return { inserted: missing.length, total: total.length };
}

/**
 * Returns all genres for use in selectors.
 */
export async function listGenres() {
  return db
    .select({ id: genres.id, tmdbId: genres.tmdbId, nameEn: genres.nameEn, nameFr: genres.nameFr })
    .from(genres)
    .orderBy(genres.nameEn);
}

/**
 * Matches genre strings (from CSV or manual input) to internal genre IDs.
 *
 * Each value is tested in order:
 *   1. Internal genre ID (e.g. "7")
 *   2. TMDB genre ID (e.g. "18")
 *   3. English name, case-insensitive (e.g. "Drama")
 *   4. French name, case-insensitive (e.g. "Drame")
 *
 * Returns only the IDs that matched (deduplicated).
 */
export async function matchGenreNamesToIds(genreValues: string[]): Promise<number[]> {
  if (genreValues.length === 0) return [];

  const allGenres = await listGenres();
  const matched: number[] = [];

  for (const value of genreValues) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const asNumber = Number(trimmed);
    const isNumeric = Number.isInteger(asNumber) && asNumber > 0;

    let match: (typeof allGenres)[number] | undefined;

    if (isNumeric) {
      match =
        allGenres.find((g) => g.id === asNumber) ?? allGenres.find((g) => g.tmdbId === asNumber);
    }

    if (!match) {
      const normalized = trimmed.toLowerCase();
      match = allGenres.find(
        (g) => g.nameEn.toLowerCase() === normalized || g.nameFr.toLowerCase() === normalized
      );
    }

    if (match) {
      matched.push(match.id);
    }
  }

  return [...new Set(matched)];
}
