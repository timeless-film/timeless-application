"use client";

import { Filter, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCatalogFilters } from "@/hooks/use-catalog-filters";

import { CatalogFilters } from "./catalog-filters";

import type { CatalogRangeFacet, GenreOption } from "@/lib/services/catalog-service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CatalogFiltersDialogProps {
  genreOptions: GenreOption[];
  directorOptions: string[];
  actorOptions: string[];
  companyOptions: string[];
  releaseYearRange: CatalogRangeFacet | null;
  durationRange: CatalogRangeFacet | null;
  unitPriceRange: CatalogRangeFacet | null;
  priceCurrencyExcludedCount: number;
  defaultPriceCurrency: string;
  totalResults: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CatalogFiltersDialog({
  genreOptions,
  directorOptions,
  actorOptions,
  companyOptions,
  releaseYearRange,
  durationRange,
  unitPriceRange,
  priceCurrencyExcludedCount,
  defaultPriceCurrency,
  totalResults,
}: CatalogFiltersDialogProps) {
  const t = useTranslations("catalog");
  const [open, setOpen] = useState(false);
  const { filters, clearFilters } = useCatalogFilters(defaultPriceCurrency);

  const activeFiltersCount = () => {
    let count = 0;
    if (filters.type !== "all") count++;
    if (filters.yearMin) count++;
    if (filters.yearMax) count++;
    if (filters.durationMin) count++;
    if (filters.durationMax) count++;
    if (filters.priceMin) count++;
    if (filters.priceMax) count++;
    if (filters.directors.length > 0) count++;
    if (filters.cast.length > 0) count++;
    if (filters.genres.length > 0) count++;
    if (filters.countries.length > 0) count++;
    if (filters.rightsHolderIds.length > 0) count++;
    if (filters.companies.length > 0) count++;
    if (!filters.availableForTerritory) count++;
    return count;
  };

  const activeCount = activeFiltersCount();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-12 gap-2 rounded-xl px-5 text-base shadow-none">
          <Filter className="h-5 w-5" />
          {t("filters.title")}
          {activeCount > 0 && (
            <Badge variant="secondary" className="rounded-full px-2">
              {activeCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("filters.title")}</DialogTitle>
          <DialogDescription>{t("filtersDialogDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-1">
          <CatalogFilters
            genreOptions={genreOptions}
            directorOptions={directorOptions}
            actorOptions={actorOptions}
            companyOptions={companyOptions}
            releaseYearRange={releaseYearRange}
            durationRange={durationRange}
            unitPriceRange={unitPriceRange}
            priceCurrencyExcludedCount={priceCurrencyExcludedCount}
            defaultPriceCurrency={defaultPriceCurrency}
          />
        </div>
        <DialogFooter className="border-t pt-4 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => void clearFilters()}
            disabled={activeCount === 0}
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            {t("filters.clearAll")}
          </Button>
          <Button onClick={() => setOpen(false)} className="rounded-xl">
            {t("showResults", { count: totalResults })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
