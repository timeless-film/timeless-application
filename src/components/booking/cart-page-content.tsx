"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { checkoutCart, removeCartItem } from "@/components/booking/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/pricing/format";

interface CartItem {
  id: string;
  filmId: string;
  screeningCount: number;
  startDate: string | null;
  endDate: string | null;
  film: { id: string; title: string; posterUrl: string | null };
  cinema: { name: string };
  room: { name: string };
  price: {
    price: number;
    currency: string;
  } | null;
}

interface CartPageContentProps {
  items: CartItem[];
}

export function CartPageContent({ items }: CartPageContentProps) {
  const t = useTranslations("cart");
  const queryClient = useQueryClient();
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [showRecalculate, setShowRecalculate] = useState(false);

  const groupedTotals = useMemo(() => {
    // Calculate totals grouped by currency
    const byDisplayCurrency: Record<string, { subtotal: number; count: number }> = {};

    items.forEach((item) => {
      if (item.price) {
        const key = item.price.currency;
        const lineTotal = item.price.price * item.screeningCount;

        if (!byDisplayCurrency[key]) {
          byDisplayCurrency[key] = { subtotal: 0, count: 0 };
        }
        byDisplayCurrency[key].subtotal += lineTotal;
        byDisplayCurrency[key].count += 1;
      }
    });

    return Object.entries(byDisplayCurrency).map(([currency, data]) => ({
      currency,
      subtotal: data.subtotal,
      count: data.count,
    }));
  }, [items]);

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
    [locale]
  );

  if (items.length === 0) {
    return <p className="text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <Link href={`/${locale}/catalog/${item.film.id}`}>
                <CardTitle className="text-lg hover:underline cursor-pointer">
                  {item.film.title}
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
                {item.film.posterUrl ? (
                  <div className="relative h-32 w-24 flex-shrink-0">
                    <Image
                      src={item.film.posterUrl}
                      alt={item.film.title}
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
                    {item.cinema.name}
                  </p>
                  <p>
                    <span className="font-medium">{t("item.room")}: </span>
                    {item.room.name}
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
                  {item.price ? (
                    <div className="pt-2 space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {t("item.price")}:{" "}
                        {formatAmount(item.price.price, item.price.currency, locale)} ×{" "}
                        {item.screeningCount}
                      </p>
                      <p className="font-semibold text-base">
                        {formatAmount(
                          item.price.price * item.screeningCount,
                          item.price.currency,
                          locale
                        )}
                      </p>
                    </div>
                  ) : (
                    <p className="pt-2 text-muted-foreground">{t("priceUnavailable")}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("summary.subtotal")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {groupedTotals.length === 0 ? (
            <p className="text-muted-foreground">{t("priceUnavailable")}</p>
          ) : (
            <>
              {groupedTotals.map((total) => (
                <div
                  key={total.currency}
                  className="space-y-2 pb-4 border-b last:border-b-0 last:pb-0"
                >
                  <p className="text-xs text-muted-foreground">{total.count} film(s)</p>
                  <p className="font-semibold text-base">
                    {formatAmount(total.subtotal, total.currency, locale)}
                  </p>
                </div>
              ))}
            </>
          )}
          <div className="pt-4 space-y-3">
            <Button
              className="w-full"
              disabled={isPending || isCheckoutLoading}
              onClick={async () => {
                setIsCheckoutLoading(true);
                const result = await checkoutCart({ recalculate: false });
                setIsCheckoutLoading(false);

                if ("error" in result) {
                  if (result.error === "PAYMENT_NOT_AVAILABLE_YET") {
                    toast.error(t("summary.paymentNotAvailable"));
                    setShowRecalculate(true);
                    return;
                  }

                  // Translate error code
                  const errorTranslationKey = `booking.errors.${result.error}` as const;
                  const errorMsg = t.has(errorTranslationKey)
                    ? t(errorTranslationKey)
                    : result.error || "An error occurred";

                  toast.error(errorMsg);

                  // Allow recalculation on validation errors
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

                // Success case (when payment is implemented in E08)
                toast.success(t("summary.checkoutSuccess"));
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
                  const result = await checkoutCart({ recalculate: true });
                  setIsCheckoutLoading(false);

                  if ("error" in result) {
                    // Translate error code
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
                    router.refresh(); // Refresh to show updated pricing
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
    </div>
  );
}
