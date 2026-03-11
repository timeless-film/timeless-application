"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { checkoutCart, removeCartItem } from "@/components/booking/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/pricing/format";

import type { CartSummary } from "@/lib/services/cart-service";

interface CartPageContentProps {
  summary: CartSummary | null;
}

export function CartPageContent({ summary }: CartPageContentProps) {
  const t = useTranslations("cart");
  const queryClient = useQueryClient();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [showRecalculate, setShowRecalculate] = useState(false);

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });

  if (!summary || (summary.items.length === 0 && summary.unavailableItems.length === 0)) {
    return <p className="text-muted-foreground">{t("empty")}</p>;
  }

  const { items, unavailableItems, subtotal, deliveryFeesTotal, total, currency } = summary;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <Link href={`/${locale}/catalog/${item.filmId}`}>
                <CardTitle className="text-lg hover:underline cursor-pointer">
                  {item.filmTitle}
                </CardTitle>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  startTransition(async () => {
                    const result = await removeCartItem(item.id);
                    if ("error" in result) {
                      toast.error(result.error);
                      return;
                    }
                    queryClient.invalidateQueries({ queryKey: ["cart-items-count"] });
                    router.refresh();
                  });
                }}
                disabled={isPending || isCheckoutLoading}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                {item.filmPosterUrl ? (
                  <div className="relative h-32 w-24 flex-shrink-0">
                    <Image
                      src={item.filmPosterUrl}
                      alt={item.filmTitle}
                      fill
                      className="rounded-md object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-32 w-24 flex-shrink-0 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground">
                    {t("noPoster")}
                  </div>
                )}

                <div className="flex-1 space-y-2 text-sm">
                  <p>
                    <span className="font-medium">{t("item.cinema")}: </span>
                    {item.cinemaName}
                  </p>
                  <p>
                    <span className="font-medium">{t("item.room")}: </span>
                    {item.roomName}
                  </p>
                  <p>
                    <span className="font-medium">{t("item.screenings")}: </span>
                    {item.screeningCount}
                  </p>
                  {item.startDate ? (
                    <p>
                      <span className="font-medium">{t("item.startDate")}: </span>
                      {dateFormatter.format(new Date(item.startDate))}
                    </p>
                  ) : null}
                  {item.endDate ? (
                    <p>
                      <span className="font-medium">{t("item.endDate")}: </span>
                      {dateFormatter.format(new Date(item.endDate))}
                    </p>
                  ) : null}
                  <div className="pt-2 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {t("item.price")}: {formatAmount(item.displayedPrice, item.currency, locale)}{" "}
                      × {item.screeningCount}
                    </p>
                    <p className="font-semibold text-base">
                      {formatAmount(
                        item.displayedPrice * item.screeningCount,
                        item.currency,
                        locale
                      )}
                    </p>
                    {item.originalCurrency && item.originalCatalogPrice !== null ? (
                      <p className="text-xs text-muted-foreground">
                        {t("item.convertedFrom", {
                          amount: formatAmount(
                            item.originalCatalogPrice,
                            item.originalCurrency,
                            locale
                          ),
                          currency: item.originalCurrency,
                        })}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {unavailableItems.length > 0 ? (
        <div className="space-y-3">
          {unavailableItems.map((item) => (
            <Card key={item.id} className="border-destructive/50 bg-destructive/5">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <CardTitle className="text-lg">{item.filmTitle}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    startTransition(async () => {
                      const result = await removeCartItem(item.id);
                      if ("error" in result) {
                        toast.error(result.error);
                        return;
                      }
                      queryClient.invalidateQueries({ queryKey: ["cart-items-count"] });
                      router.refresh();
                    });
                  }}
                  disabled={isPending || isCheckoutLoading}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {item.cinemaName} — {item.roomName}
                </p>
                <p className="text-sm text-destructive mt-1">
                  {t(`item.unavailableReason.${item.reason}`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {items.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("summary.total")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("summary.filmCount", { count: items.length })}
              </p>
              <div className="flex justify-between">
                <span>{t("summary.subtotal")}</span>
                <span>{formatAmount(subtotal, currency, locale)}</span>
              </div>
              {deliveryFeesTotal > 0 ? (
                <div className="flex justify-between">
                  <span>{t("summary.deliveryFees")}</span>
                  <span>{formatAmount(deliveryFeesTotal, currency, locale)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-semibold text-base pt-2 border-t">
                <span>{t("summary.total")}</span>
                <span>{formatAmount(total, currency, locale)}</span>
              </div>
            </div>
            <div className="pt-4 space-y-3">
              <Button
                className="w-full"
                disabled={isPending || isCheckoutLoading}
                onClick={async () => {
                  setIsCheckoutLoading(true);
                  const result = await checkoutCart({ recalculate: false, locale });
                  setIsCheckoutLoading(false);

                  if ("error" in result) {
                    const errorTranslationKey = `booking.errors.${result.error}` as const;
                    const errorMsg = t.has(errorTranslationKey)
                      ? t(errorTranslationKey)
                      : result.error || "An error occurred";

                    toast.error(errorMsg);

                    const errorNeedsRecalc = [
                      "PRICE_CHANGED",
                      "TERRITORY_NOT_AVAILABLE",
                      "FILM_NOT_AVAILABLE",
                    ] as const;
                    if (
                      result.error &&
                      errorNeedsRecalc.includes(result.error as (typeof errorNeedsRecalc)[number])
                    ) {
                      setShowRecalculate(true);
                    }
                    return;
                  }

                  if ("redirectUrl" in result && result.redirectUrl) {
                    // Redirect to Stripe Checkout
                    window.location.href = result.redirectUrl;
                  }
                }}
              >
                {t("summary.checkout")}
              </Button>

              {showRecalculate ? (
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={isPending || isCheckoutLoading}
                  onClick={async () => {
                    setIsCheckoutLoading(true);
                    const result = await checkoutCart({ recalculate: true, locale });
                    setIsCheckoutLoading(false);

                    if ("error" in result) {
                      const errorTranslationKey = `booking.errors.${result.error}` as const;
                      const errorMsg = t.has(errorTranslationKey)
                        ? t(errorTranslationKey)
                        : result.error || "An error occurred";
                      toast.error(errorMsg);
                      return;
                    }

                    if ("success" in result && result.recalculated) {
                      setShowRecalculate(false);
                      toast.success(t("summary.recalculated"));
                      router.refresh();
                      return;
                    }

                    setShowRecalculate(false);
                    toast.success(t("summary.recalculated"));
                  }}
                >
                  {t("summary.recalculate")}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
