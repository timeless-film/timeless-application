"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/pricing/format";

import { FilmActionModal } from "./film-action-modal";

import type { FilmWithAvailability } from "@/lib/services/catalog-service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilmDetailContentProps {
  film: FilmWithAvailability;
  accountId: string;
  existingRequests: Array<{
    id: string;
    status: string;
    cinemaName: string;
    roomName: string;
  }>;
  cinemas: Array<{
    id: string;
    name: string;
    country: string;
    rooms: Array<{ id: string; name: string; capacity: number }>;
  }>;
  preferredCurrency: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FilmDetailContent({
  film,
  accountId,
  existingRequests,
  cinemas,
  preferredCurrency,
}: FilmDetailContentProps) {
  const t = useTranslations("catalog.film");
  const tStatus = useTranslations("requests.status");
  const locale = useLocale();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const backdropUrl = film.backdropUrl;
  const posterUrl = film.posterUrl;

  const isAvailable = film.availableForAccount;
  const isDirect = film.type === "direct";
  const synopsis = locale === "en" && film.synopsisEn ? film.synopsisEn : film.synopsis;

  return (
    <>
      <div className="min-h-screen">
        {/* Hero Backdrop */}
        {backdropUrl && (
          <div className="relative h-[40vh] w-full">
            <ImageWithFallback
              src={backdropUrl}
              alt={film.title}
              className="object-cover"
              sizes="100vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          </div>
        )}

        {/* Content */}
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            {/* Main Content */}
            <div className="space-y-6">
              {/* Title + Badges */}
              <div className="space-y-3">
                <h1 className="font-heading text-4xl">{film.title}</h1>
                {film.originalTitle && film.originalTitle !== film.title && (
                  <p className="text-lg text-muted-foreground">{film.originalTitle}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant={isDirect ? "default" : "secondary"}>
                    {isDirect ? t("typeDirect") : t("typeValidation")}
                  </Badge>
                  {!isAvailable && (
                    <Badge variant="outline" className="border-destructive text-destructive">
                      {t("unavailable")}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Info Grid */}
              <Card>
                <CardHeader>
                  <CardTitle>{t("information")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {film.directors && film.directors.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t("director")}</p>
                      <p>{film.directors.join(", ")}</p>
                    </div>
                  )}
                  {film.cast && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t("cast")}</p>
                      <p className="line-clamp-2">{film.cast.join(", ")}</p>
                    </div>
                  )}
                  {film.releaseYear && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t("yearLabel")}</p>
                      <p>{t("year", { year: film.releaseYear })}</p>
                    </div>
                  )}
                  {film.duration && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t("durationLabel")}
                      </p>
                      <p>{t("duration", { duration: film.duration })}</p>
                    </div>
                  )}
                  {film.genres && film.genres.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t("genres")}</p>
                      <p>{film.genres.join(", ")}</p>
                    </div>
                  )}
                  {film.countries && film.countries.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t("countries")}</p>
                      <p>{film.countries.join(", ")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Synopsis */}
              {synopsis && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("synopsis")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{synopsis}</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar: Poster + Action */}
            <aside className="space-y-6">
              {/* Poster */}
              {posterUrl && (
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg">
                  <ImageWithFallback
                    src={posterUrl}
                    alt={film.title}
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 320px"
                  />
                </div>
              )}

              {/* Action Card */}
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>{t("pricing")}</CardTitle>
                  {film.matchingPrices && film.matchingPrices.length > 0 && (
                    <CardDescription>
                      {film.matchingPrices.length === 1
                        ? t("singleZone")
                        : t("multipleZones", { count: film.matchingPrices.length })}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Prices */}
                  {film.matchingPrices && film.matchingPrices.length > 0 ? (
                    <div className="space-y-2">
                      {film.matchingPrices.map((price, idx) => (
                        <div key={idx} className="flex items-baseline justify-between">
                          <span className="text-sm text-muted-foreground">
                            {t("zone", { number: idx + 1 })}
                          </span>
                          <span className="text-lg font-semibold">
                            {formatAmount(price.price, price.currency, locale)}{" "}
                            <span className="text-sm font-normal text-muted-foreground">
                              {price.currency}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("noPricing")}</p>
                  )}

                  {/* CTA Button */}
                  <Button
                    onClick={() => setIsModalOpen(true)}
                    disabled={!isAvailable}
                    className="w-full"
                    size="lg"
                  >
                    {isDirect ? t("addToCart") : t("sendRequest")}
                  </Button>

                  {!isAvailable && (
                    <p className="text-center text-xs text-muted-foreground">
                      {t("unavailableHint")}
                    </p>
                  )}

                  {existingRequests.length > 0 ? (
                    <div className="rounded-md border border-border/60 bg-muted/35 p-2.5 text-xs">
                      <p className="mb-1 font-medium text-foreground">
                        {t("modal.existingRequestsTitle")}
                      </p>
                      <ul className="space-y-1 text-muted-foreground">
                        {existingRequests.map((requestItem) => (
                          <li key={requestItem.id}>
                            {tStatus(
                              requestItem.status as
                                | "pending"
                                | "approved"
                                | "rejected"
                                | "cancelled"
                                | "paid"
                            )}{" "}
                            - {requestItem.cinemaName} / {requestItem.roomName}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
      </div>

      {/* Modal */}
      <FilmActionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        film={film}
        accountId={accountId}
        cinemas={cinemas}
        preferredCurrency={preferredCurrency}
        isDirect={isDirect}
      />
    </>
  );
}
