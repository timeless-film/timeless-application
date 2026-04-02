"use client";

import { ImageIcon, LayoutList, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { CatalogFiltersDialog } from "@/components/catalog/catalog-filters-dialog";
import { FilmCard } from "@/components/catalog/film-card";
import { FilmCardSimple } from "@/components/catalog/film-card-simple";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCatalogFilters } from "@/hooks/use-catalog-filters";

import type { CatalogFiltersState } from "@/hooks/use-catalog-filters";
import type {
  CatalogRangeFacet,
  FilmWithAvailability,
  GenreOption,
} from "@/lib/services/catalog-service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CatalogPageContentProps {
  initialFilms: FilmWithAvailability[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
  genreOptions: GenreOption[];
  directorOptions: string[];
  actorOptions: string[];
  companyOptions: string[];
  totalPlatformFilms: number;
  releaseYearRange: CatalogRangeFacet | null;
  durationRange: CatalogRangeFacet | null;
  unitPriceRange: CatalogRangeFacet | null;
  priceCurrencyExcludedCount: number;
  defaultPriceCurrency: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CatalogPageContent({
  initialFilms,
  initialTotal,
  initialPage,
  initialLimit,
  genreOptions,
  directorOptions,
  actorOptions,
  companyOptions,
  totalPlatformFilms,
  releaseYearRange,
  durationRange,
  unitPriceRange,
  priceCurrencyExcludedCount,
  defaultPriceCurrency,
}: CatalogPageContentProps) {
  const t = useTranslations("catalog");
  const locale = useLocale();
  const { filters, setFilters } = useCatalogFilters(defaultPriceCurrency);

  const [viewMode, setViewMode] = useState<"dense" | "simple">(() => {
    if (typeof window === "undefined") return "simple";
    const stored = localStorage.getItem("catalog-view-mode");
    return stored === "dense" ? "dense" : "simple";
  });

  function handleViewModeChange(value: string) {
    if (value === "dense" || value === "simple") {
      setViewMode(value);
      localStorage.setItem("catalog-view-mode", value);
    }
  }

  const totalPages = Math.ceil(initialTotal / initialLimit);

  return (
    <div
      className="mx-auto max-w-7xl space-y-4 px-4 py-8 lg:px-6 2xl:max-w-[1440px]"
      suppressHydrationWarning
    >
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-heading text-3xl">{t("title")}</h1>
        <p>{t("description")}</p>
      </div>

      {/* Search bar + Filters button */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" />
          <Input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={filters.search || ""}
            onChange={(e) => void setFilters({ search: e.target.value || null })}
            className="h-12 rounded-xl border-foreground/20 bg-white pl-11 text-base dark:bg-background"
          />
        </div>
        <CatalogFiltersDialog
          genreOptions={genreOptions}
          directorOptions={directorOptions}
          actorOptions={actorOptions}
          companyOptions={companyOptions}
          releaseYearRange={releaseYearRange}
          durationRange={durationRange}
          unitPriceRange={unitPriceRange}
          priceCurrencyExcludedCount={priceCurrencyExcludedCount}
          defaultPriceCurrency={defaultPriceCurrency}
          totalResults={initialTotal}
        />
      </div>

      {/* Toolbar: Results count + Sort + View toggle */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          <span>
            {initialTotal} {t("resultsCount")}
            {initialTotal !== totalPlatformFilms && (
              <span className="ml-1">
                ({t("resultsOutOf")} {totalPlatformFilms} {t("resultsPlatformTotal")})
              </span>
            )}
          </span>
        </div>

        {/* Sort + View controls */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("sortBy")}</span>
          <Select
            value={filters.sort}
            onValueChange={(value) =>
              void setFilters({ sort: value as CatalogFiltersState["sort"] })
            }
          >
            <SelectTrigger className="h-8 w-auto border-0 bg-transparent px-2 text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">{t("sortTitle")}</SelectItem>
              <SelectItem value="releaseYear">{t("sortYear")}</SelectItem>
              <SelectItem value="price">{t("sortPrice")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.order}
            onValueChange={(value) =>
              void setFilters({ order: value as CatalogFiltersState["order"] })
            }
          >
            <SelectTrigger className="h-8 w-auto border-0 bg-transparent px-2 text-xs shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">{t("sortAsc")}</SelectItem>
              <SelectItem value="desc">{t("sortDesc")}</SelectItem>
            </SelectContent>
          </Select>

          <div className="bg-border mx-1 h-4 w-px" />

          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={handleViewModeChange}
            className="h-8"
          >
            <ToggleGroupItem
              value="dense"
              aria-label={t("viewDense")}
              className="h-7 w-7 p-0 data-[state=on]:bg-muted data-[state=on]:text-foreground"
            >
              <LayoutList className="h-3.5 w-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="simple"
              aria-label={t("viewSimple")}
              className="h-7 w-7 p-0 data-[state=on]:bg-muted data-[state=on]:text-foreground"
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Films grid — full width */}
      {initialFilms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">{t("noResults")}</p>
        </div>
      ) : (
        <div
          className={
            viewMode === "simple"
              ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:gap-10"
              : "grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:gap-10"
          }
        >
          {initialFilms.map((film) =>
            viewMode === "simple" ? (
              <FilmCardSimple key={film.id} film={film} />
            ) : (
              <FilmCard key={film.id} film={film} locale={locale} />
            )
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => {
                  if (initialPage > 1) {
                    void setFilters({ page: initialPage - 1 });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className={initialPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>

            {/* Page numbers (show max 5 pages) */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (initialPage <= 3) {
                pageNum = i + 1;
              } else if (initialPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = initialPage - 2 + i;
              }

              return (
                <PaginationItem key={pageNum}>
                  <PaginationLink
                    onClick={() => {
                      void setFilters({ page: pageNum });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    isActive={pageNum === initialPage}
                    className="cursor-pointer"
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              );
            })}

            <PaginationItem>
              <PaginationNext
                onClick={() => {
                  if (initialPage < totalPages) {
                    void setFilters({ page: initialPage + 1 });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className={
                  initialPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
