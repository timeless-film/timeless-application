"use client";

import { useLocale, useTranslations } from "next-intl";

import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { FilmCard } from "@/components/catalog/film-card";
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
import { useCatalogFilters } from "@/hooks/use-catalog-filters";

import type { CatalogFiltersState } from "@/hooks/use-catalog-filters";
import type { CatalogRangeFacet, FilmWithAvailability } from "@/lib/services/catalog-service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CatalogPageContentProps {
  initialFilms: FilmWithAvailability[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
  genreOptions: string[];
  totalPlatformFilms: number;
  releaseYearRange: CatalogRangeFacet | null;
  durationRange: CatalogRangeFacet | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CatalogPageContent({
  initialFilms,
  initialTotal,
  initialPage,
  initialLimit,
  genreOptions,
  totalPlatformFilms,
  releaseYearRange,
  durationRange,
}: CatalogPageContentProps) {
  const t = useTranslations("catalog");
  const locale = useLocale();
  const { filters, setFilters } = useCatalogFilters();

  const totalPages = Math.ceil(initialTotal / initialLimit);

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 lg:px-6" suppressHydrationWarning>
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-heading text-3xl">{t("title")}</h1>
        <p>{t("description")}</p>
      </div>

      {/* Toolbar: Sort + Results count */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span>
            {initialTotal} {t("resultsCount")}{" "}
            {initialTotal !== totalPlatformFilms && (
              <span className="ml-1">
                ({t("resultsOutOf")} {totalPlatformFilms} {t("resultsPlatformTotal")})
              </span>
            )}
          </span>
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("sortBy")}</span>
          <Select
            value={filters.sort}
            onValueChange={(value) =>
              void setFilters({ sort: value as CatalogFiltersState["sort"] })
            }
          >
            <SelectTrigger className="w-[140px]">
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
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">{t("sortAsc")}</SelectItem>
              <SelectItem value="desc">{t("sortDesc")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters + Results Layout */}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
        {/* Sidebar: Filters */}
        <aside className="space-y-4 lg:sticky lg:top-24">
          <CatalogFilters
            genreOptions={genreOptions}
            releaseYearRange={releaseYearRange}
            durationRange={durationRange}
          />
        </aside>

        {/* Main: Results */}
        <main className="space-y-6">
          {/* Films grid */}
          {initialFilms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">{t("noResults")}</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {initialFilms.map((film) => (
                <FilmCard key={film.id} film={film} locale={locale} />
              ))}
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
                      }
                    }}
                    className={
                      initialPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                    }
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
                        onClick={() => void setFilters({ page: pageNum })}
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
                      }
                    }}
                    className={
                      initialPage >= totalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </main>
      </div>
    </div>
  );
}
