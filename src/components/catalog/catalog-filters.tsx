"use client";

import { Check, ChevronsUpDown, Filter, RotateCcw, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { CatalogRangeFilter } from "@/components/catalog/catalog-range-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCatalogFilters } from "@/hooks/use-catalog-filters";
import { getCurrencyOptions } from "@/lib/currencies";
import { cn } from "@/lib/utils";

import type { CatalogFiltersState } from "@/hooks/use-catalog-filters";
import type { CatalogRangeFacet } from "@/lib/services/catalog-service";

// ─── Component ────────────────────────────────────────────────────────────────

interface CatalogFiltersProps {
  genreOptions: string[];
  releaseYearRange: CatalogRangeFacet | null;
  durationRange: CatalogRangeFacet | null;
  unitPriceRange: CatalogRangeFacet | null;
  priceCurrencyExcludedCount: number;
  defaultPriceCurrency: string;
}

export function CatalogFilters({
  genreOptions,
  releaseYearRange,
  durationRange,
  unitPriceRange,
  priceCurrencyExcludedCount,
  defaultPriceCurrency,
}: CatalogFiltersProps) {
  const t = useTranslations("catalog.filters");
  const locale = useLocale();
  const { filters, setFilters, clearFilters } = useCatalogFilters(defaultPriceCurrency);
  const [isGenrePopoverOpen, setIsGenrePopoverOpen] = useState(false);
  const currencyOptions = getCurrencyOptions(locale);
  const isPriceRangeActive = filters.priceMin !== null || filters.priceMax !== null;

  const formatPriceInEuros = (valueInCents: number) => Math.round(valueInCents / 100);

  const toggleGenre = async (genre: string) => {
    const nextGenres = filters.genres.includes(genre)
      ? filters.genres.filter((item) => item !== genre)
      : [...filters.genres, genre];

    await setFilters({ genres: nextGenres });
  };

  // Count active filters (excluding defaults)
  const activeFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
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
    if (!filters.availableForTerritory) count++;
    return count;
  };

  const activeCount = activeFiltersCount();
  const priceRangeHelperText =
    isPriceRangeActive && priceCurrencyExcludedCount > 0
      ? t("priceCurrencyMissingHint", {
          count: priceCurrencyExcludedCount,
          currency: filters.priceCurrency,
        })
      : undefined;
  const priceRangeDisabledText = unitPriceRange
    ? undefined
    : t("priceCurrencyNoFilmsHint", { currency: filters.priceCurrency });

  return (
    <div
      className="space-y-6 rounded-xl border border-border/70 bg-card/90 p-5 shadow-sm backdrop-blur-sm"
      suppressHydrationWarning
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-accent/15 text-accent-foreground flex h-8 w-8 items-center justify-center rounded-full">
            <Filter className="h-4 w-4" />
          </div>
          <h3 className="font-heading text-lg">
            {t("title")}
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-2 rounded-full px-2.5">
                {activeCount}
              </Badge>
            )}
          </h3>
        </div>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => void clearFilters()}
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            {t("clearAll")}
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="space-y-2">
        <Label htmlFor="search" className="text-foreground/85 text-xs tracking-wide uppercase">
          {t("search")}
        </Label>
        <Input
          id="search"
          type="text"
          placeholder={t("searchPlaceholder")}
          value={filters.search || ""}
          onChange={(e) => void setFilters({ search: e.target.value || null })}
          className="bg-background"
        />
      </div>

      {/* Film Type */}
      <div className="space-y-2">
        <Label htmlFor="type" className="text-foreground/85 text-xs tracking-wide uppercase">
          {t("filmType")}
        </Label>
        <Select
          value={filters.type}
          onValueChange={(value) => void setFilters({ type: value as CatalogFiltersState["type"] })}
        >
          <SelectTrigger id="type" className="bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("typeAll")}</SelectItem>
            <SelectItem value="direct">{t("typeDirect")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Genres */}
      <div className="space-y-2">
        <Label htmlFor="genres" className="text-foreground/85 text-xs tracking-wide uppercase">
          {t("genre")}
        </Label>
        <Popover open={isGenrePopoverOpen} onOpenChange={setIsGenrePopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              id="genres"
              variant="outline"
              role="combobox"
              aria-expanded={isGenrePopoverOpen}
              className="bg-background w-full justify-between font-normal"
            >
              <span className="truncate text-left">
                {filters.genres.length > 0
                  ? `${filters.genres.slice(0, 2).join(", ")}${filters.genres.length > 2 ? ` +${filters.genres.length - 2}` : ""}`
                  : t("genresSelectPlaceholder")}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-(--radix-popover-trigger-width) border-border/70 bg-popover p-0"
            align="start"
          >
            <Command>
              <CommandInput placeholder={t("genresSearchPlaceholder")} />
              <CommandList>
                <CommandEmpty>{t("genresEmpty")}</CommandEmpty>
                <CommandGroup>
                  {genreOptions.map((genre) => (
                    <CommandItem
                      key={genre}
                      value={genre}
                      onSelect={() => {
                        void toggleGenre(genre);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          filters.genres.includes(genre) ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {genre}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Territory Availability */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="availableForTerritory"
          checked={filters.availableForTerritory}
          onChange={(e) => void setFilters({ availableForTerritory: e.target.checked })}
          className="text-accent focus:ring-accent h-4 w-4 rounded border-input"
        />
        <Label htmlFor="availableForTerritory" className="cursor-pointer">
          {t("availableInMyTerritories")}
        </Label>
      </div>

      <CatalogRangeFilter
        title={t("releaseYear")}
        minLabel={t("yearMinExplicit")}
        maxLabel={t("yearMaxExplicit")}
        facet={releaseYearRange}
        selectedMin={filters.yearMin}
        selectedMax={filters.yearMax}
        onChange={(yearMin, yearMax) => setFilters({ yearMin, yearMax })}
      />

      <CatalogRangeFilter
        title={t("duration")}
        minLabel={t("durationMinExplicit")}
        maxLabel={t("durationMaxExplicit")}
        facet={durationRange}
        selectedMin={filters.durationMin}
        selectedMax={filters.durationMax}
        valueSuffix={t("durationUnitShort")}
        onChange={(durationMin, durationMax) => setFilters({ durationMin, durationMax })}
      />

      <CatalogRangeFilter
        title={t("unitPrice")}
        titleAction={
          <Select
            value={filters.priceCurrency}
            onValueChange={(value) => void setFilters({ priceCurrency: value })}
          >
            <SelectTrigger
              id="price-currency"
              className="h-7 w-auto min-w-0 gap-1 border-0 bg-transparent px-0 py-0 text-xs font-medium shadow-none"
              aria-label={t("priceCurrency")}
            >
              <SelectValue>{filters.priceCurrency}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {currencyOptions.map((currency) => (
                <SelectItem key={currency.value} value={currency.value}>
                  {currency.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        minLabel={t("priceMinExplicit", { currency: filters.priceCurrency })}
        maxLabel={t("priceMaxExplicit", { currency: filters.priceCurrency })}
        facet={unitPriceRange}
        selectedMin={filters.priceMin}
        selectedMax={filters.priceMax}
        valueUnit="cents"
        valueSuffix={` ${filters.priceCurrency}`}
        helperText={priceRangeHelperText}
        disabledText={priceRangeDisabledText}
        onChange={(priceMin, priceMax) => setFilters({ priceMin, priceMax })}
      />

      {/* Active Filters Summary */}
      {activeCount > 0 && (
        <div className="space-y-2 border-t border-border/60 pt-4">
          <Label className="text-xs text-muted-foreground">{t("activeFilters")}</Label>
          <div className="flex flex-wrap gap-2">
            {filters.search && (
              <Badge variant="outline" className="bg-muted/45 gap-1">
                Search: {filters.search}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => void setFilters({ search: null })}
                />
              </Badge>
            )}
            {filters.type !== "all" && (
              <Badge variant="outline" className="bg-muted/45 gap-1">
                Type: {filters.type}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => void setFilters({ type: "all" })}
                />
              </Badge>
            )}
            {filters.genres.length > 0 && (
              <Badge variant="outline" className="bg-muted/45 gap-1">
                {t("genre")}: {filters.genres.slice(0, 2).join(", ")}
                {filters.genres.length > 2 ? "..." : ""}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => void setFilters({ genres: [] })}
                />
              </Badge>
            )}
            {filters.yearMin && (
              <Badge variant="outline" className="bg-muted/45 gap-1">
                Year ≥ {filters.yearMin}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => void setFilters({ yearMin: null })}
                />
              </Badge>
            )}
            {filters.yearMax && (
              <Badge variant="outline" className="bg-muted/45 gap-1">
                Year ≤ {filters.yearMax}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => void setFilters({ yearMax: null })}
                />
              </Badge>
            )}
            {filters.durationMin && (
              <Badge variant="outline" className="bg-muted/45 gap-1">
                Duration ≥ {filters.durationMin}min
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => void setFilters({ durationMin: null })}
                />
              </Badge>
            )}
            {filters.durationMax && (
              <Badge variant="outline" className="bg-muted/45 gap-1">
                Duration ≤ {filters.durationMax}min
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => void setFilters({ durationMax: null })}
                />
              </Badge>
            )}
            {filters.priceMin && (
              <Badge variant="outline" className="bg-muted/45 gap-1">
                {t("price")} ≥ {formatPriceInEuros(filters.priceMin)} {filters.priceCurrency}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => void setFilters({ priceMin: null })}
                />
              </Badge>
            )}
            {filters.priceMax && (
              <Badge variant="outline" className="bg-muted/45 gap-1">
                {t("price")} ≤ {formatPriceInEuros(filters.priceMax)} {filters.priceCurrency}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => void setFilters({ priceMax: null })}
                />
              </Badge>
            )}
            {!filters.availableForTerritory && (
              <Badge variant="outline" className="bg-muted/45 gap-1">
                Show all territories
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => void setFilters({ availableForTerritory: true })}
                />
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
