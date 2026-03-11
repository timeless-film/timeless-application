"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

import type { FilmWithAvailability } from "@/lib/services/catalog-service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilmCardProps {
  film: FilmWithAvailability;
  locale: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FilmCard({ film, locale }: FilmCardProps) {
  const t = useTranslations("catalog.film.card");
  // Format price in the film's native currency
  const formatPrice = (cents: number | null, currency: string) => {
    if (cents === null) return null;
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const coverImageSource = film.backdropUrl ?? film.posterUrl;
  const posterImageSource = film.posterUrl ?? film.backdropUrl;
  const usesPosterAsCover = !film.backdropUrl && Boolean(film.posterUrl);
  const coverImageClassName = usesPosterAsCover
    ? "object-cover scale-105 opacity-85 transition-transform duration-500 group-hover:scale-110"
    : "object-cover transition-transform duration-500 group-hover:scale-105";

  return (
    <Link
      href={`/catalog/${film.id}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
    >
      <Card className="group relative h-[360px] cursor-pointer overflow-hidden border-border/70 bg-card/95 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
        {/* Cover image */}
        <div className="relative h-36 w-full overflow-hidden bg-muted/60">
          <ImageWithFallback
            src={coverImageSource}
            alt={film.title}
            className={coverImageClassName}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/45 to-transparent" />

          {/* Availability badge (top-right) */}
          {film.isAvailableInTerritory && (
            <div className="absolute top-2 right-2">
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {t("available")}
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="-mt-[65px] flex h-[216px] flex-col p-4 pt-0">
          <div className="flex items-end gap-4">
            <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-md border border-background/90 bg-muted shadow-2xl">
              <ImageWithFallback
                src={posterImageSource}
                alt={film.title}
                className="object-cover"
                sizes="96px"
              />
            </div>

            <div className="min-w-0 flex-1 pb-0.5">
              <h3 className="line-clamp-2 text-base font-semibold leading-tight">{film.title}</h3>
              {film.directors && film.directors.length > 0 && (
                <p className="line-clamp-1 text-sm text-muted-foreground/90">{film.directors[0]}</p>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-1 flex-col pt-3">
            <div className="space-y-2">
              {/* Metadata row */}
              {(film.releaseYear || film.duration) && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {film.releaseYear && (
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/80">
                      {film.releaseYear}
                    </span>
                  )}
                  {film.duration && (
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/80">
                      {film.duration} min
                    </span>
                  )}
                </div>
              )}

              {/* Genres */}
              {film.genres && film.genres.length > 0 && (
                <p className="line-clamp-1 text-sm text-muted-foreground">
                  {film.genres.slice(0, 3).join(" · ")}
                </p>
              )}
            </div>

            {/* Price / availability (always pinned to bottom) */}
            <div className="mt-auto pt-2">
              <div className="rounded-md border border-border/60 bg-muted/35 p-2.5">
                {film.isAvailableInTerritory ? (
                  <div className="space-y-1.5">
                    {film.displayedPrice !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {t("direct")}
                        </span>
                        <span className="text-sm font-semibold">
                          {formatPrice(film.displayedPrice, film.priceCurrency ?? "EUR")}{" "}
                          {t("excludingTax")}
                        </span>
                      </div>
                    )}
                    {film.displayedPriceStarting !== null && film.hasDemandsEnabled && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {t("onDemand")}
                        </span>
                        <span className="text-sm font-semibold">
                          {t("from", {
                            price:
                              formatPrice(
                                film.displayedPriceStarting,
                                film.priceCurrency ?? "EUR"
                              ) ?? "",
                          })}{" "}
                          {t("excludingTax")}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("notAvailable")}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
