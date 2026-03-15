"use client";

import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  useQueryStates,
} from "nuqs";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortField = "title" | "releaseYear" | "price";
export type SortOrder = "asc" | "desc";
export type FilmType = "direct" | "all";

export interface CatalogFiltersState {
  // Pagination
  page: number;
  limit: number;

  // Sort
  sort: SortField;
  order: SortOrder;

  // Search
  search: string | null;

  // Multi-select filters
  directors: string[];
  cast: string[];
  genres: string[];
  countries: string[];
  rightsHolderIds: string[];

  // Single-select filters
  type: FilmType;

  // Range filters
  yearMin: number | null;
  yearMax: number | null;
  durationMin: number | null;
  durationMax: number | null;
  priceMin: number | null;
  priceMax: number | null;
  priceCurrency: string;

  // Territory availability
  availableForTerritory: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Type-safe hook for managing catalog filters via URL query params.
 *
 * Features:
 * - Syncs all filters with URL (shareable links, browser back/forward)
 * - Provides `setFilters` for batch updates
 * - Provides individual setters for granular control
 * - Automatically resets page to 1 when filters change
 */
export function useCatalogFilters(defaultPriceCurrency: string = "EUR") {
  const normalizedDefaultPriceCurrency = defaultPriceCurrency.toUpperCase();

  const [filters, setFilters] = useQueryStates(
    {
      // Pagination
      page: parseAsInteger.withDefault(1),
      limit: parseAsInteger.withDefault(24),

      // Sort
      sort: parseAsStringEnum<SortField>(["title", "releaseYear", "price"]).withDefault("title"),
      order: parseAsStringEnum<SortOrder>(["asc", "desc"]).withDefault("asc"),

      // Search
      search: parseAsString,

      // Multi-select filters
      directors: parseAsArrayOf(parseAsString).withDefault([]),
      cast: parseAsArrayOf(parseAsString).withDefault([]),
      genres: parseAsArrayOf(parseAsString).withDefault([]),
      countries: parseAsArrayOf(parseAsString).withDefault([]),
      rightsHolderIds: parseAsArrayOf(parseAsString).withDefault([]),

      // Single-select filters
      type: parseAsStringEnum<FilmType>(["direct", "all"]).withDefault("all"),

      // Range filters
      yearMin: parseAsInteger,
      yearMax: parseAsInteger,
      durationMin: parseAsInteger,
      durationMax: parseAsInteger,
      priceMin: parseAsInteger,
      priceMax: parseAsInteger,
      priceCurrency: parseAsString.withDefault(normalizedDefaultPriceCurrency),

      // Territory availability
      availableForTerritory: parseAsString
        .withDefault("true")
        .withOptions({ shallow: false }) as unknown as typeof parseAsString,
    },
    { shallow: false, history: "push" }
  );

  // Normalize availableForTerritory to boolean
  const normalizedFilters: CatalogFiltersState = {
    ...filters,
    priceCurrency:
      filters.priceCurrency && filters.priceCurrency.trim().length > 0
        ? filters.priceCurrency.toUpperCase()
        : normalizedDefaultPriceCurrency,
    availableForTerritory: filters.availableForTerritory !== "false",
  };

  // Reset page to 1 when non-pagination filters change
  const updateFilters = async (updates: Partial<CatalogFiltersState>) => {
    const hasFilterChange = Object.keys(updates).some((key) => key !== "page" && key !== "limit");

    // Convert boolean availableForTerritory to string for nuqs
    const convertedUpdates: Record<string, unknown> = { ...updates };
    if ("availableForTerritory" in convertedUpdates) {
      convertedUpdates["availableForTerritory"] = convertedUpdates.availableForTerritory
        ? "true"
        : "false";
    }

    if ("priceCurrency" in convertedUpdates) {
      const nextPriceCurrency = convertedUpdates.priceCurrency;
      if (typeof nextPriceCurrency === "string") {
        convertedUpdates["priceCurrency"] =
          nextPriceCurrency.trim().length > 0
            ? nextPriceCurrency.toUpperCase()
            : normalizedDefaultPriceCurrency;
      }
    }

    if (hasFilterChange) {
      await setFilters({ ...convertedUpdates, page: 1 } as typeof convertedUpdates);
    } else {
      await setFilters(convertedUpdates as typeof convertedUpdates);
    }
  };

  // Clear all filters (reset to defaults)
  const clearFilters = async () => {
    await setFilters({
      page: 1,
      limit: 24,
      sort: "title",
      order: "asc",
      search: null,
      directors: [],
      cast: [],
      genres: [],
      countries: [],
      rightsHolderIds: [],
      type: "all",
      yearMin: null,
      yearMax: null,
      durationMin: null,
      durationMax: null,
      priceMin: null,
      priceMax: null,
      priceCurrency: normalizedDefaultPriceCurrency,
      availableForTerritory: "true",
    });
  };

  return {
    filters: normalizedFilters,
    setFilters: updateFilters,
    clearFilters,
  };
}
