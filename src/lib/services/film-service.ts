import { and, count, eq, ilike, ne, or } from "drizzle-orm";

import { STRIPE_CURRENCY_CODES } from "@/lib/currencies";
import { db } from "@/lib/db";
import { filmPrices, films } from "@/lib/db/schema";

import type { CountryCode } from "@/lib/countries";

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
