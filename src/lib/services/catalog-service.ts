import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  ilike,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts, cinemas, filmPrices, films } from "@/lib/db/schema";
import { calculatePricing, getPlatformPricingSettings, resolveCommissionRate } from "@/lib/pricing";

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

/** Raw price zone data from DB — returned by checkFilmAvailability (internal). */
export interface PriceZoneMatch {
  id: string;
  countries: CountryCode[];
  price: number; // catalog price in cents
  currency: string;
}

/** Enriched price zone with displayedPrice — used in FilmWithAvailability. */
export interface MatchingPrice extends PriceZoneMatch {
  displayedPrice: number; // catalog price + platform margin (cents, excl. delivery fees)
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
  displayedPrice: number | null; // In cents, catalog price + margin (excl. delivery). Null if type="validation"
  displayedPriceStarting: number | null; // In cents, catalog price + margin (excl. delivery). Null if type="direct"
  priceCurrency: string | null; // Currency of the best matching price zone
  hasDemandsEnabled: boolean;
  // Territory availability
  isAvailableInTerritory: boolean;
  matchingPriceZones: CountryCode[];
  availableForAccount: boolean; // Deprecated (use isAvailableInTerritory)
  matchingPrices: MatchingPrice[]; // All matching price zones (enriched with displayedPrice)
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
  releaseYearRange: CatalogRangeFacet | null;
  durationRange: CatalogRangeFacet | null;
}

export interface CatalogRangeFacet {
  min: number;
  max: number;
  buckets: number[];
}

type CatalogNumericField = "releaseYear" | "duration";

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
  matchingPrices: PriceZoneMatch[];
}> {
  if (accountCountries.length === 0) {
    return { available: false, matchingPrices: [] };
  }

  const prices = await db.query.filmPrices.findMany({
    where: eq(filmPrices.filmId, filmId),
  });

  const matchingPrices: PriceZoneMatch[] = [];

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

function removeRangeFilter(filters: CatalogFilters, field: CatalogNumericField): CatalogFilters {
  if (field === "releaseYear") {
    return {
      ...filters,
      yearMin: undefined,
      yearMax: undefined,
    };
  }

  return {
    ...filters,
    durationMin: undefined,
    durationMax: undefined,
  };
}

function buildRangeFacet(values: number[]): CatalogRangeFacet | null {
  if (values.length === 0) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const buckets = Array.from({ length: 10 }, () => 0);

  if (min === max) {
    buckets[0] = values.length;
    return { min, max, buckets };
  }

  const span = max - min;

  for (const value of values) {
    const bucketIndex = Math.min(9, Math.floor(((value - min) / span) * 10));
    const currentCount = buckets[bucketIndex];

    if (currentCount !== undefined) {
      buckets[bucketIndex] = currentCount + 1;
    }
  }

  return { min, max, buckets };
}

async function getRangeFacetForField(
  accountId: string,
  filters: CatalogFilters,
  field: CatalogNumericField
): Promise<CatalogRangeFacet | null> {
  const accountCountries = await getAccountCinemaCountries(accountId);
  const rangeFreeFilters = removeRangeFilter(filters, field);
  const whereCondition = buildCatalogQueryConditions(rangeFreeFilters, accountCountries);

  if (field === "releaseYear") {
    const rows = await db
      .select({ value: films.releaseYear })
      .from(films)
      .where(and(whereCondition, isNotNull(films.releaseYear)));

    return buildRangeFacet(rows.flatMap((row) => (row.value === null ? [] : [row.value])));
  }

  const rows = await db
    .select({ value: films.duration })
    .from(films)
    .where(and(whereCondition, isNotNull(films.duration)));

  return buildRangeFacet(rows.flatMap((row) => (row.value === null ? [] : [row.value])));
}

/**
 * Fetches distinct filter options for the catalog UI.
 */
export async function getCatalogFilterOptions(
  accountId: string,
  filters: CatalogFilters = {}
): Promise<CatalogFilterOptions> {
  const [genreRows, countResult, releaseYearRange, durationRange] = await Promise.all([
    db
      .select({ genre: sql<string>`DISTINCT UNNEST(${films.genres})` })
      .from(films)
      .where(eq(films.status, "active")),
    db.select({ count: count() }).from(films).where(eq(films.status, "active")),
    getRangeFacetForField(accountId, filters, "releaseYear"),
    getRangeFacetForField(accountId, filters, "duration"),
  ]);

  const genres = [...new Set(genreRows.map((row) => row.genre?.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );

  const totalFilms = countResult[0]?.count ?? 0;

  return { genres, totalFilms, releaseYearRange, durationRange };
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
        accountCommissionRate: accounts.commissionRate,
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

  // Fetch platform pricing settings once for all films
  const platformSettings = await getPlatformPricingSettings();

  // Enrich with availability + matching prices + displayedPrice
  const enrichedFilms: FilmWithAvailability[] = await Promise.all(
    filmsList.map(async (film) => {
      const { available, matchingPrices: rawPrices } = await checkFilmAvailability(
        film.id,
        accountCountries
      );

      const commissionRate = resolveCommissionRate(
        film.accountCommissionRate,
        platformSettings.defaultCommissionRate
      );

      // Enrich each matching price with displayedPrice
      const enrichedPrices: MatchingPrice[] = rawPrices.map((zone) => {
        const pricing = calculatePricing({
          catalogPrice: zone.price,
          currency: zone.currency,
          platformMarginRate: platformSettings.platformMarginRate,
          deliveryFees: platformSettings.deliveryFees,
          commissionRate,
        });
        return { ...zone, displayedPrice: pricing.displayedPrice };
      });

      // Select best price zone:
      // 1. Most countries matching
      // 2. If tie → lowest displayedPrice
      let bestPrice: MatchingPrice | null = null;
      if (enrichedPrices.length > 0) {
        enrichedPrices.sort((a, b) => {
          const matchCountA = a.countries.filter((c) => accountCountries.includes(c)).length;
          const matchCountB = b.countries.filter((c) => accountCountries.includes(c)).length;
          if (matchCountA !== matchCountB) {
            return matchCountB - matchCountA; // More matches first
          }
          return a.displayedPrice - b.displayedPrice; // Lower price first
        });
        bestPrice = enrichedPrices[0] || null;
      }

      // Extract all matching country codes
      const matchingZones = [
        ...new Set(
          enrichedPrices.flatMap((p) => p.countries.filter((c) => accountCountries.includes(c)))
        ),
      ];

      // Price assignment based on film type (using displayedPrice)
      const displayedPrice = film.type === "direct" && bestPrice ? bestPrice.displayedPrice : null;
      const displayedPriceStarting =
        film.type === "validation" && bestPrice ? bestPrice.displayedPrice : null;
      const priceCurrency = bestPrice?.currency ?? null;
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
        rightsHolderId: film.accountId,
        rightsHolderName: film.accountName,
        displayedPrice,
        displayedPriceStarting,
        priceCurrency,
        hasDemandsEnabled,
        isAvailableInTerritory: available,
        matchingPriceZones: matchingZones as CountryCode[],
        availableForAccount: available,
        matchingPrices: enrichedPrices,
        createdAt: film.createdAt,
        updatedAt: film.createdAt,
      };
    })
  );

  // Apply price sort in-memory if needed (prices are not in main query)
  if (sort.field === "price") {
    enrichedFilms.sort((a, b) => {
      const priceA = a.displayedPrice ?? a.displayedPriceStarting ?? Infinity;
      const priceB = b.displayedPrice ?? b.displayedPriceStarting ?? Infinity;
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

  // Get rights holder name and commission rate
  const [rightsHolder] = await db
    .select({
      companyName: accounts.companyName,
      commissionRate: accounts.commissionRate,
    })
    .from(accounts)
    .where(eq(accounts.id, film.accountId))
    .limit(1);

  const { available, matchingPrices: rawPrices } = await checkFilmAvailability(
    filmId,
    accountCountries
  );

  // Fetch platform pricing settings
  const platformSettings = await getPlatformPricingSettings();
  const commissionRate = resolveCommissionRate(
    rightsHolder?.commissionRate,
    platformSettings.defaultCommissionRate
  );

  // Enrich each matching price with displayedPrice
  const enrichedPrices: MatchingPrice[] = rawPrices.map((zone) => {
    const pricing = calculatePricing({
      catalogPrice: zone.price,
      currency: zone.currency,
      platformMarginRate: platformSettings.platformMarginRate,
      deliveryFees: platformSettings.deliveryFees,
      commissionRate,
    });
    return { ...zone, displayedPrice: pricing.displayedPrice };
  });

  // Select best price zone (same logic as in getCatalogForExhibitor)
  let bestPrice: MatchingPrice | null = null;
  if (enrichedPrices.length > 0) {
    enrichedPrices.sort((a, b) => {
      const matchCountA = a.countries.filter((c) => accountCountries.includes(c)).length;
      const matchCountB = b.countries.filter((c) => accountCountries.includes(c)).length;
      if (matchCountA !== matchCountB) {
        return matchCountB - matchCountA;
      }
      return a.displayedPrice - b.displayedPrice;
    });
    bestPrice = enrichedPrices[0] || null;
  }

  const matchingZones = [
    ...new Set(
      enrichedPrices.flatMap((p) => p.countries.filter((c) => accountCountries.includes(c)))
    ),
  ];

  const displayedPrice = film.type === "direct" && bestPrice ? bestPrice.displayedPrice : null;
  const displayedPriceStarting =
    film.type === "validation" && bestPrice ? bestPrice.displayedPrice : null;
  const priceCurrency = bestPrice?.currency ?? null;
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
    displayedPrice,
    displayedPriceStarting,
    priceCurrency,
    hasDemandsEnabled,
    isAvailableInTerritory: available,
    matchingPriceZones: matchingZones as CountryCode[],
    availableForAccount: available,
    matchingPrices: enrichedPrices,
    createdAt: film.createdAt,
    updatedAt: film.updatedAt,
  };
}
