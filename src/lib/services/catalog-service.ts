import { and, asc, count, desc, eq, gte, inArray, ilike, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts, cinemas, filmPrices, films } from "@/lib/db/schema";

import type { CountryCode } from "@/lib/countries";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CatalogFilters {
  search?: string;
  directors?: string[];
  cast?: string[];
  genres?: string[];
  countries?: string[];
  rightsHolderIds?: string[];
  type?: "direct" | "all";
  yearMin?: number;
  yearMax?: number;
  durationMin?: number;
  durationMax?: number;
  availableForTerritory?: boolean; // Default true
}

export interface CatalogPagination {
  page: number;
  limit: number;
}

export interface CatalogSort {
  field: "title" | "releaseYear" | "price";
  order: "asc" | "desc";
}

export interface MatchingPrice {
  id: string;
  countries: CountryCode[];
  price: number;
  currency: string;
}

export interface FilmWithAvailability {
  id: string;
  title: string;
  originalTitle: string | null;
  synopsis: string | null;
  synopsisEn: string | null;
  duration: number | null;
  releaseYear: number | null;
  genres: string[] | null;
  directors: string[] | null;
  cast: string[] | null;
  countries: string[] | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  type: "direct" | "validation";
  tmdbRating: string | null;
  accountId: string;
  accountName: string | null;
  rightsHolderId: string;
  rightsHolderName: string | null;
  // Pricing (single best zone for this exhibitor)
  catalogPriceHt: number | null; // In cents, null if type="validation"
  demandPriceStartingHt: number | null; // In cents, null if type="direct"
  hasDemandsEnabled: boolean;
  // Territory availability
  isAvailableInTerritory: boolean;
  matchingPriceZones: CountryCode[];
  availableForAccount: boolean; // Deprecated (use isAvailableInTerritory)
  matchingPrices: MatchingPrice[]; // All matching price zones
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogResult {
  films: FilmWithAvailability[];
  total: number;
  page: number;
  limit: number;
}

export interface CatalogFilterOptions {
  genres: string[];
  totalFilms: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the list of active cinema countries for an exhibitor account.
 */
async function getAccountCinemaCountries(accountId: string): Promise<CountryCode[]> {
  const accountCinemas = await db.query.cinemas.findMany({
    where: and(eq(cinemas.accountId, accountId), isNull(cinemas.archivedAt)),
    columns: { country: true },
  });

  const uniqueCountries = [...new Set(accountCinemas.map((c) => c.country as CountryCode))];
  return uniqueCountries;
}

/**
 * Checks if a film has at least one price zone compatible with the given countries.
 * Returns availability status + matching price zones.
 */
export async function checkFilmAvailability(
  filmId: string,
  accountCountries: CountryCode[]
): Promise<{
  available: boolean;
  matchingPrices: MatchingPrice[];
}> {
  if (accountCountries.length === 0) {
    return { available: false, matchingPrices: [] };
  }

  const prices = await db.query.filmPrices.findMany({
    where: eq(filmPrices.filmId, filmId),
  });

  const matchingPrices: MatchingPrice[] = [];

  for (const priceZone of prices) {
    const intersection = priceZone.countries.filter((c) =>
      accountCountries.includes(c as CountryCode)
    );

    if (intersection.length > 0) {
      matchingPrices.push({
        id: priceZone.id,
        countries: priceZone.countries as CountryCode[],
        price: priceZone.price,
        currency: priceZone.currency,
      });
    }
  }

  return {
    available: matchingPrices.length > 0,
    matchingPrices,
  };
}

// ─── Query Builder ────────────────────────────────────────────────────────────

/**
 * Builds the catalog query with filters, pagination, and sort.
 * Returns base query conditions + order clause.
 */
function buildCatalogQueryConditions(filters: CatalogFilters, accountCountries: CountryCode[]) {
  const conditions: ReturnType<typeof and>[] = [];

  // Base: active films only
  conditions.push(eq(films.status, "active"));

  // Search: title
  if (filters.search?.trim()) {
    const searchTerm = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(films.title, searchTerm),
        ilike(films.originalTitle, searchTerm),
        sql`COALESCE(array_to_string(${films.directors}, ', '), '') ILIKE ${searchTerm}`,
        sql`COALESCE(array_to_string(${films.cast}, ', '), '') ILIKE ${searchTerm}`
      )
    );
  }

  // Multi-select: directors
  if (filters.directors && filters.directors.length > 0) {
    const directorConditions = filters.directors.map(
      (director) => sql`${films.directors} @> ARRAY[${director}]::text[]`
    );
    conditions.push(or(...directorConditions));
  }

  // Multi-select: cast
  if (filters.cast && filters.cast.length > 0) {
    const castConditions = filters.cast.map(
      (actor) => sql`${films.cast} @> ARRAY[${actor}]::text[]`
    );
    conditions.push(or(...castConditions));
  }

  // Multi-select: genres
  if (filters.genres && filters.genres.length > 0) {
    const genreConditions = filters.genres.map(
      (genre) => sql`${films.genres} @> ARRAY[${genre}]::text[]`
    );
    conditions.push(or(...genreConditions));
  }

  // Multi-select: countries
  if (filters.countries && filters.countries.length > 0) {
    const countryConditions = filters.countries.map(
      (country) => sql`${films.countries} @> ARRAY[${country}]::text[]`
    );
    conditions.push(or(...countryConditions));
  }

  // Multi-select: rights holder IDs
  if (filters.rightsHolderIds && filters.rightsHolderIds.length > 0) {
    conditions.push(inArray(films.accountId, filters.rightsHolderIds));
  }

  // Type filter
  if (filters.type === "direct") {
    conditions.push(eq(films.type, "direct"));
  }

  // Year range
  if (filters.yearMin !== undefined) {
    conditions.push(gte(films.releaseYear, filters.yearMin));
  }
  if (filters.yearMax !== undefined) {
    conditions.push(lte(films.releaseYear, filters.yearMax));
  }

  // Duration range
  if (filters.durationMin !== undefined) {
    conditions.push(gte(films.duration, filters.durationMin));
  }
  if (filters.durationMax !== undefined) {
    conditions.push(lte(films.duration, filters.durationMax));
  }

  // Territory availability filter (SQL EXISTS subquery with array overlap)
  if (filters.availableForTerritory !== false && accountCountries.length > 0) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${filmPrices}
        WHERE ${filmPrices.filmId} = ${films.id}
        AND ${filmPrices.countries} && ARRAY[${sql.join(
          accountCountries.map((c) => sql`${c}`),
          sql`, `
        )}]::text[]
      )`
    );
  }

  return and(...conditions);
}

/**
 * Fetches distinct filter options for the catalog UI.
 */
export async function getCatalogFilterOptions(): Promise<CatalogFilterOptions> {
  const [genreRows, countResult] = await Promise.all([
    db
      .select({ genre: sql<string>`DISTINCT UNNEST(${films.genres})` })
      .from(films)
      .where(eq(films.status, "active")),
    db.select({ count: count() }).from(films).where(eq(films.status, "active")),
  ]);

  const genres = [...new Set(genreRows.map((row) => row.genre?.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );

  const totalFilms = countResult[0]?.count ?? 0;

  return { genres, totalFilms };
}

// ─── Catalog for Exhibitor ────────────────────────────────────────────────────

/**
 * Fetches the catalog of films available for an exhibitor account.
 * Enriches each film with availability and matching prices.
 */
export async function getCatalogForExhibitor(
  accountId: string,
  filters: CatalogFilters = {},
  pagination: CatalogPagination = { page: 1, limit: 24 },
  sort: CatalogSort = { field: "title", order: "asc" }
): Promise<CatalogResult> {
  // Get account's cinema countries
  const accountCountries = await getAccountCinemaCountries(accountId);

  // Build query conditions
  const whereCondition = buildCatalogQueryConditions(filters, accountCountries);

  // Determine sort clause
  const orderClause =
    sort.order === "asc"
      ? sort.field === "title"
        ? asc(films.title)
        : sort.field === "releaseYear"
          ? asc(films.releaseYear)
          : asc(films.title) // Default for price (will sort in memory)
      : sort.field === "title"
        ? desc(films.title)
        : sort.field === "releaseYear"
          ? desc(films.releaseYear)
          : desc(films.title);

  // Calculate offset
  const offset = (pagination.page - 1) * pagination.limit;

  // Fetch films + account info
  const [filmsList, totalResult] = await Promise.all([
    db
      .select({
        id: films.id,
        title: films.title,
        originalTitle: films.originalTitle,
        synopsis: films.synopsis,
        synopsisEn: films.synopsisEn,
        duration: films.duration,
        releaseYear: films.releaseYear,
        genres: films.genres,
        directors: films.directors,
        cast: films.cast,
        countries: films.countries,
        posterUrl: films.posterUrl,
        backdropUrl: films.backdropUrl,
        type: films.type,
        tmdbRating: films.tmdbRating,
        accountId: films.accountId,
        accountName: accounts.companyName,
        createdAt: films.createdAt,
      })
      .from(films)
      .leftJoin(accounts, eq(films.accountId, accounts.id))
      .where(whereCondition)
      .orderBy(orderClause)
      .limit(pagination.limit)
      .offset(offset),
    db.select({ value: count() }).from(films).where(whereCondition),
  ]);

  // Enrich with availability + matching prices
  const enrichedFilms: FilmWithAvailability[] = await Promise.all(
    filmsList.map(async (film) => {
      const { available, matchingPrices } = await checkFilmAvailability(film.id, accountCountries);

      // Select best price zone:
      // 1. Most countries matching
      // 2. If tie → lowest price
      let bestPrice: MatchingPrice | null = null;
      if (matchingPrices.length > 0) {
        matchingPrices.sort((a, b) => {
          const matchCountA = a.countries.filter((c) => accountCountries.includes(c)).length;
          const matchCountB = b.countries.filter((c) => accountCountries.includes(c)).length;
          if (matchCountA !== matchCountB) {
            return matchCountB - matchCountA; // More matches first
          }
          return a.price - b.price; // Lower price first
        });
        bestPrice = matchingPrices[0] || null;
      }

      // Extract all matching country codes
      const matchingZones = [
        ...new Set(
          matchingPrices.flatMap((p) => p.countries.filter((c) => accountCountries.includes(c)))
        ),
      ];

      // Price assignment based on film type
      const catalogPriceHt = film.type === "direct" && bestPrice ? bestPrice.price : null;
      const demandPriceStartingHt =
        film.type === "validation" && bestPrice ? bestPrice.price : null;
      const hasDemandsEnabled = film.type === "validation";

      return {
        id: film.id,
        title: film.title,
        originalTitle: film.originalTitle,
        synopsis: film.synopsis,
        synopsisEn: film.synopsisEn,
        duration: film.duration,
        releaseYear: film.releaseYear,
        genres: film.genres,
        directors: film.directors,
        cast: film.cast,
        countries: film.countries,
        posterUrl: film.posterUrl,
        backdropUrl: film.backdropUrl,
        type: film.type as "direct" | "validation",
        tmdbRating: film.tmdbRating,
        accountId: film.accountId,
        accountName: film.accountName,
        rightsHolderId: film.accountId, // Same as accountId (rights holder owns the film)
        rightsHolderName: film.accountName,
        catalogPriceHt,
        demandPriceStartingHt,
        hasDemandsEnabled,
        isAvailableInTerritory: available,
        matchingPriceZones: matchingZones as CountryCode[],
        availableForAccount: available, // Deprecated (alias)
        matchingPrices,
        createdAt: film.createdAt,
        updatedAt: film.createdAt, // Assuming no updatedAt in select
      };
    })
  );

  // Apply price sort in-memory if needed (prices are not in main query)
  if (sort.field === "price") {
    enrichedFilms.sort((a, b) => {
      const priceA = a.catalogPriceHt ?? a.demandPriceStartingHt ?? Infinity;
      const priceB = b.catalogPriceHt ?? b.demandPriceStartingHt ?? Infinity;
      return sort.order === "asc" ? priceA - priceB : priceB - priceA;
    });
  }

  const total = totalResult[0]?.value ?? 0;

  return {
    films: enrichedFilms,
    total,
    page: pagination.page,
    limit: pagination.limit,
  };
}

/**
 * Gets a single film detail with availability for an exhibitor.
 */
export async function getFilmForExhibitor(
  filmId: string,
  accountId: string
): Promise<FilmWithAvailability | null> {
  const accountCountries = await getAccountCinemaCountries(accountId);

  const film = await db.query.films.findFirst({
    where: and(eq(films.id, filmId), eq(films.status, "active")),
    columns: {
      id: true,
      title: true,
      originalTitle: true,
      synopsis: true,
      synopsisEn: true,
      duration: true,
      releaseYear: true,
      genres: true,
      directors: true,
      cast: true,
      countries: true,
      posterUrl: true,
      backdropUrl: true,
      type: true,
      tmdbRating: true,
      accountId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!film) {
    return null;
  }

  // Get rights holder name separately
  const [rightsHolder] = await db
    .select({ companyName: accounts.companyName })
    .from(accounts)
    .where(eq(accounts.id, film.accountId))
    .limit(1);

  const { available, matchingPrices } = await checkFilmAvailability(filmId, accountCountries);

  // Select best price zone (same logic as in getCatalogForExhibitor)
  let bestPrice: MatchingPrice | null = null;
  if (matchingPrices.length > 0) {
    matchingPrices.sort((a, b) => {
      const matchCountA = a.countries.filter((c) => accountCountries.includes(c)).length;
      const matchCountB = b.countries.filter((c) => accountCountries.includes(c)).length;
      if (matchCountA !== matchCountB) {
        return matchCountB - matchCountA;
      }
      return a.price - b.price;
    });
    bestPrice = matchingPrices[0] || null;
  }

  const matchingZones = [
    ...new Set(
      matchingPrices.flatMap((p) => p.countries.filter((c) => accountCountries.includes(c)))
    ),
  ];

  const catalogPriceHt = film.type === "direct" && bestPrice ? bestPrice.price : null;
  const demandPriceStartingHt = film.type === "validation" && bestPrice ? bestPrice.price : null;
  const hasDemandsEnabled = film.type === "validation";

  return {
    id: film.id,
    title: film.title,
    originalTitle: film.originalTitle,
    synopsis: film.synopsis,
    synopsisEn: film.synopsisEn,
    duration: film.duration,
    releaseYear: film.releaseYear,
    genres: film.genres,
    directors: film.directors,
    cast: film.cast,
    countries: film.countries,
    posterUrl: film.posterUrl,
    backdropUrl: film.backdropUrl,
    type: film.type as "direct" | "validation",
    tmdbRating: film.tmdbRating,
    accountId: film.accountId,
    accountName: rightsHolder?.companyName ?? null,
    rightsHolderId: film.accountId,
    rightsHolderName: rightsHolder?.companyName ?? null,
    catalogPriceHt,
    demandPriceStartingHt,
    hasDemandsEnabled,
    isAvailableInTerritory: available,
    matchingPriceZones: matchingZones as CountryCode[],
    availableForAccount: available,
    matchingPrices,
    createdAt: film.createdAt,
    updatedAt: film.updatedAt,
  };
}
