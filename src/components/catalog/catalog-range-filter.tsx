"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import type { CatalogRangeFacet } from "@/lib/services/catalog-service";

interface CatalogRangeFilterProps {
  title: string;
  titleAction?: ReactNode;
  minLabel: string;
  maxLabel: string;
  facet: CatalogRangeFacet | null;
  selectedMin: number | null;
  selectedMax: number | null;
  valueUnit?: "raw" | "cents";
  valueSuffix?: string;
  helperText?: string;
  disabledText?: string;
  onChange: (nextMin: number | null, nextMax: number | null) => Promise<void> | void;
}

export function CatalogRangeFilter({
  title,
  titleAction,
  minLabel,
  maxLabel,
  facet,
  selectedMin,
  selectedMax,
  valueUnit = "raw",
  valueSuffix,
  helperText,
  disabledText,
  onChange,
}: CatalogRangeFilterProps) {
  if (!facet) {
    return (
      <div className="space-y-4 py-1">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-foreground/85 text-xs tracking-wide uppercase">{title}</Label>
          {titleAction}
        </div>

        <div className="space-y-2">
          <div className="bg-muted/35 h-18 rounded" />
          <Slider min={0} max={1} value={[0, 1]} disabled aria-label={title} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="block truncate text-xs text-muted-foreground" title={minLabel}>
              {minLabel}
            </Label>
            <Input type="number" disabled className="h-10 bg-background text-sm" />
          </div>

          <div className="space-y-2">
            <Label className="block truncate text-xs text-muted-foreground" title={maxLabel}>
              {maxLabel}
            </Label>
            <Input type="number" disabled className="h-10 bg-background text-sm" />
          </div>
        </div>

        {disabledText && <p className="text-xs text-muted-foreground">{disabledText}</p>}
      </div>
    );
  }

  return (
    <CatalogRangeFilterControl
      key={`${facet.min}-${facet.max}-${selectedMin ?? "min"}-${selectedMax ?? "max"}`}
      title={title}
      titleAction={titleAction}
      minLabel={minLabel}
      maxLabel={maxLabel}
      facet={facet}
      selectedMin={selectedMin}
      selectedMax={selectedMax}
      valueUnit={valueUnit}
      valueSuffix={valueSuffix}
      helperText={helperText}
      onChange={onChange}
    />
  );
}

interface CatalogRangeFilterControlProps {
  title: string;
  titleAction?: ReactNode;
  minLabel: string;
  maxLabel: string;
  facet: CatalogRangeFacet;
  selectedMin: number | null;
  selectedMax: number | null;
  valueUnit: "raw" | "cents";
  valueSuffix?: string;
  helperText?: string;
  onChange: (nextMin: number | null, nextMax: number | null) => Promise<void> | void;
}

function CatalogRangeFilterControl({
  title,
  titleAction,
  minLabel,
  maxLabel,
  facet,
  selectedMin,
  selectedMax,
  valueUnit,
  valueSuffix,
  helperText,
  onChange,
}: CatalogRangeFilterControlProps) {
  const t = useTranslations("catalog.filters");
  const baseId = useId();
  const resolvedMin = selectedMin ?? facet.min;
  const resolvedMax = selectedMax ?? facet.max;

  const toDisplayValue = (value: number) => {
    if (valueUnit === "cents") {
      return Math.round(value / 100);
    }

    return value;
  };

  const toStoredValue = (value: number) => {
    if (valueUnit === "cents") {
      return value * 100;
    }

    return value;
  };

  const formatDisplayValue = (value: number) => {
    const convertedValue = toDisplayValue(value);
    return `${convertedValue}${valueSuffix ?? ""}`;
  };

  const [draftRange, setDraftRange] = useState<[number, number]>([resolvedMin, resolvedMax]);
  const [minInput, setMinInput] = useState(String(toDisplayValue(resolvedMin)));
  const [maxInput, setMaxInput] = useState(String(toDisplayValue(resolvedMax)));

  async function commitRange(nextMin: number, nextMax: number) {
    const clampedMin = Math.max(facet.min, Math.min(nextMin, facet.max));
    const clampedMax = Math.max(facet.min, Math.min(nextMax, facet.max));
    const normalizedMin = Math.min(clampedMin, clampedMax);
    const normalizedMax = Math.max(clampedMin, clampedMax);

    setDraftRange([normalizedMin, normalizedMax]);
    setMinInput(String(toDisplayValue(normalizedMin)));
    setMaxInput(String(toDisplayValue(normalizedMax)));

    await onChange(
      normalizedMin <= facet.min ? null : normalizedMin,
      normalizedMax >= facet.max ? null : normalizedMax
    );
  }

  function parseInputValue(value: string, fallback: number) {
    if (value.trim() === "") {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  async function commitInputValues() {
    await commitRange(
      toStoredValue(parseInputValue(minInput, toDisplayValue(facet.min))),
      toStoredValue(parseInputValue(maxInput, toDisplayValue(facet.max)))
    );
  }

  const peak = Math.max(...facet.buckets, 1);
  const bucketCount = facet.buckets.length;
  const bucketSpan = facet.max - facet.min;

  function isBucketOutsideSelectedRange(index: number) {
    if (bucketCount <= 0) {
      return false;
    }

    if (bucketSpan === 0) {
      return draftRange[0] > facet.min || draftRange[1] < facet.max;
    }

    const bucketStart = facet.min + (index / bucketCount) * bucketSpan;
    const bucketEnd =
      index === bucketCount - 1 ? facet.max : facet.min + ((index + 1) / bucketCount) * bucketSpan;

    return bucketEnd < draftRange[0] || bucketStart > draftRange[1];
  }

  function getBucketTooltip(index: number, count: number) {
    if (bucketSpan === 0) {
      return t("bucketTooltipSingle", {
        value: formatDisplayValue(facet.min),
        count,
      });
    }

    const bucketStart = facet.min + (index / bucketCount) * bucketSpan;
    const bucketEndRaw =
      index === bucketCount - 1 ? facet.max : facet.min + ((index + 1) / bucketCount) * bucketSpan;

    const fromValue = Math.floor(bucketStart);
    const toValue = Math.ceil(bucketEndRaw);

    return t("bucketTooltipRange", {
      from: formatDisplayValue(fromValue),
      to: formatDisplayValue(toValue),
      count,
    });
  }

  return (
    <div className="space-y-4 py-1">
      <div className="flex items-center justify-between gap-3">
        <Label className="text-foreground/85 text-xs tracking-wide uppercase">{title}</Label>
        {titleAction}
      </div>

      <div>
        <TooltipProvider delayDuration={0} skipDelayDuration={0}>
          <div className="flex h-18 items-end gap-1.5 px-1">
            {facet.buckets.map((bucket, index) => {
              const height = `${Math.max((bucket / peak) * 100, bucket > 0 ? 16 : 6)}%`;
              const outsideSelectedRange = isBucketOutsideSelectedRange(index);
              const tooltipLabel = getBucketTooltip(index, bucket);

              return (
                <Tooltip key={`${baseId}-${index}`}>
                  <TooltipTrigger asChild>
                    <div
                      className="bg-accent flex-1 cursor-help transition-opacity"
                      style={{
                        height,
                        opacity: outsideSelectedRange ? 0.22 : bucket === 0 ? 0.35 : 0.95,
                      }}
                      aria-label={tooltipLabel}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {tooltipLabel}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        <Slider
          min={facet.min}
          max={facet.max}
          step={1}
          value={draftRange}
          onValueChange={(value) => {
            const nextRange: [number, number] = [value[0] ?? facet.min, value[1] ?? facet.max];
            setDraftRange(nextRange);
            setMinInput(String(toDisplayValue(nextRange[0])));
            setMaxInput(String(toDisplayValue(nextRange[1])));
          }}
          onValueCommit={(value) => {
            void commitRange(value[0] ?? facet.min, value[1] ?? facet.max);
          }}
          minStepsBetweenThumbs={0}
          aria-label={title}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label
            htmlFor={`${baseId}-min`}
            className="block truncate text-xs text-muted-foreground"
            title={minLabel}
          >
            {minLabel}
          </Label>
          <Input
            id={`${baseId}-min`}
            type="number"
            inputMode="numeric"
            value={minInput}
            min={toDisplayValue(facet.min)}
            max={toDisplayValue(draftRange[1])}
            onChange={(event) => setMinInput(event.target.value)}
            onBlur={() => {
              void commitInputValues();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void commitInputValues();
              }
            }}
            className="h-10 bg-background text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor={`${baseId}-max`}
            className="block truncate text-xs text-muted-foreground"
            title={maxLabel}
          >
            {maxLabel}
          </Label>
          <Input
            id={`${baseId}-max`}
            type="number"
            inputMode="numeric"
            value={maxInput}
            min={toDisplayValue(draftRange[0])}
            max={toDisplayValue(facet.max)}
            onChange={(event) => setMaxInput(event.target.value)}
            onBlur={() => {
              void commitInputValues();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void commitInputValues();
              }
            }}
            className="h-10 bg-background text-sm"
          />
        </div>
      </div>

      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  );
}
