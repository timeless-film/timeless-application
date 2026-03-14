"use client";

import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

import type { CatalogRangeFacet } from "@/lib/services/catalog-service";

interface CatalogRangeFilterProps {
  title: string;
  minLabel: string;
  maxLabel: string;
  facet: CatalogRangeFacet | null;
  selectedMin: number | null;
  selectedMax: number | null;
  onChange: (nextMin: number | null, nextMax: number | null) => Promise<void> | void;
}

export function CatalogRangeFilter({
  title,
  minLabel,
  maxLabel,
  facet,
  selectedMin,
  selectedMax,
  onChange,
}: CatalogRangeFilterProps) {
  if (!facet) {
    return null;
  }

  return (
    <CatalogRangeFilterControl
      key={`${facet.min}-${facet.max}-${selectedMin ?? "min"}-${selectedMax ?? "max"}`}
      title={title}
      minLabel={minLabel}
      maxLabel={maxLabel}
      facet={facet}
      selectedMin={selectedMin}
      selectedMax={selectedMax}
      onChange={onChange}
    />
  );
}

interface CatalogRangeFilterControlProps {
  title: string;
  minLabel: string;
  maxLabel: string;
  facet: CatalogRangeFacet;
  selectedMin: number | null;
  selectedMax: number | null;
  onChange: (nextMin: number | null, nextMax: number | null) => Promise<void> | void;
}

function CatalogRangeFilterControl({
  title,
  minLabel,
  maxLabel,
  facet,
  selectedMin,
  selectedMax,
  onChange,
}: CatalogRangeFilterControlProps) {
  const baseId = useId();
  const resolvedMin = selectedMin ?? facet.min;
  const resolvedMax = selectedMax ?? facet.max;
  const [draftRange, setDraftRange] = useState<[number, number]>([resolvedMin, resolvedMax]);
  const [minInput, setMinInput] = useState(String(resolvedMin));
  const [maxInput, setMaxInput] = useState(String(resolvedMax));

  async function commitRange(nextMin: number, nextMax: number) {
    const clampedMin = Math.max(facet.min, Math.min(nextMin, facet.max));
    const clampedMax = Math.max(facet.min, Math.min(nextMax, facet.max));
    const normalizedMin = Math.min(clampedMin, clampedMax);
    const normalizedMax = Math.max(clampedMin, clampedMax);

    setDraftRange([normalizedMin, normalizedMax]);
    setMinInput(String(normalizedMin));
    setMaxInput(String(normalizedMax));

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
    await commitRange(parseInputValue(minInput, facet.min), parseInputValue(maxInput, facet.max));
  }

  const peak = Math.max(...facet.buckets, 1);

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
      <div className="space-y-1">
        <Label className="text-sm font-semibold text-foreground">{title}</Label>
      </div>

      <div className="space-y-3">
        <div className="flex h-18 items-end gap-1.5 px-1">
          {facet.buckets.map((bucket, index) => {
            const height = `${Math.max((bucket / peak) * 100, bucket > 0 ? 16 : 6)}%`;

            return (
              <div
                key={`${baseId}-${index}`}
                className="flex-1 rounded-sm bg-primary/90 transition-opacity"
                style={{ height, opacity: bucket === 0 ? 0.18 : 1 }}
                aria-hidden="true"
              />
            );
          })}
        </div>

        <Slider
          min={facet.min}
          max={facet.max}
          step={1}
          value={draftRange}
          onValueChange={(value) => {
            const nextRange: [number, number] = [value[0] ?? facet.min, value[1] ?? facet.max];
            setDraftRange(nextRange);
            setMinInput(String(nextRange[0]));
            setMaxInput(String(nextRange[1]));
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
          <Label htmlFor={`${baseId}-min`} className="text-xs text-muted-foreground">
            {minLabel}
          </Label>
          <Input
            id={`${baseId}-min`}
            type="number"
            inputMode="numeric"
            value={minInput}
            min={facet.min}
            max={draftRange[1]}
            onChange={(event) => setMinInput(event.target.value)}
            onBlur={() => {
              void commitInputValues();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void commitInputValues();
              }
            }}
            className="h-11 rounded-full text-center text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${baseId}-max`} className="text-xs text-muted-foreground">
            {maxLabel}
          </Label>
          <Input
            id={`${baseId}-max`}
            type="number"
            inputMode="numeric"
            value={maxInput}
            min={draftRange[0]}
            max={facet.max}
            onChange={(event) => setMaxInput(event.target.value)}
            onBlur={() => {
              void commitInputValues();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void commitInputValues();
              }
            }}
            className="h-11 rounded-full text-center text-base"
          />
        </div>
      </div>
    </div>
  );
}
