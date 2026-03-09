"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useTransition } from "react";
import { toast } from "sonner";

import { cancelRequest, relaunchRequest } from "@/components/booking/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/pricing/format";

interface RequestItem {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "paid" | string;
  screeningCount: number;
  startDate: string | null;
  endDate: string | null;
  displayedPrice: number;
  currency: string;
  createdAt: string | Date;
  film: { id: string; title: string; posterUrl: string | null };
  rightsHolderAccount: { companyName: string | null };
  cinema: { name: string };
  room: { name: string };
  createdByUser: { name: string } | null;
}

interface RequestsPageContentProps {
  requests: RequestItem[];
}

type StatusVariant = "default" | "secondary" | "destructive" | "outline";

function statusBadgeVariant(status: string): StatusVariant {
  switch (status) {
    case "pending":
      return "secondary";
    case "approved":
      return "default";
    case "rejected":
      return "destructive";
    case "cancelled":
      return "outline";
    case "paid":
      return "default";
    default:
      return "outline";
  }
}

export function RequestsPageContent({ requests }: RequestsPageContentProps) {
  const t = useTranslations("requests");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
    [locale]
  );

  const statusLabel = (status: string) => {
    const mapping: Record<string, string> = {
      pending: t("status.pending"),
      approved: t("status.approved"),
      validated: t("status.approved"),
      rejected: t("status.rejected"),
      refused: t("status.rejected"),
      cancelled: t("status.cancelled"),
      paid: t("status.paid"),
    };

    return mapping[status] ?? status;
  };

  if (requests.length === 0) {
    return <p className="text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="space-y-3">
      {requests.map((requestItem) => (
        <Card key={requestItem.id}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={`/${locale}/catalog/${requestItem.film.id}`}>
                <CardTitle className="text-lg hover:underline cursor-pointer">
                  {requestItem.film.title}
                </CardTitle>
              </Link>
              <Badge variant={statusBadgeVariant(requestItem.status)}>
                {statusLabel(requestItem.status)}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              {requestItem.status === "pending" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    startTransition(async () => {
                      const result = await cancelRequest(requestItem.id);
                      if ("error" in result) {
                        toast.error(result.error);
                        return;
                      }
                      router.refresh();
                    });
                  }}
                  disabled={isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              ) : null}
              {(requestItem.status === "cancelled" || requestItem.status === "rejected") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    startTransition(async () => {
                      const result = await relaunchRequest(requestItem.id);
                      if ("error" in result) {
                        toast.error(result.error);
                        return;
                      }
                      router.refresh();
                    });
                  }}
                  disabled={isPending}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              {requestItem.film.posterUrl ? (
                <div className="relative h-32 w-24 flex-shrink-0">
                  <Image
                    src={requestItem.film.posterUrl}
                    alt={requestItem.film.title}
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
                  <span className="font-medium">{t("columns.rightsHolder")}: </span>
                  {requestItem.rightsHolderAccount.companyName ?? "-"}
                </p>
                <p>
                  <span className="font-medium">{t("columns.cinema")}: </span>
                  {requestItem.cinema.name}
                </p>
                <p>
                  <span className="font-medium">{t("item.room")}: </span>
                  {requestItem.room.name}
                </p>
                <p>
                  <span className="font-medium">{t("item.screenings")}: </span>
                  {requestItem.screeningCount}
                </p>
                <p>
                  <span className="font-medium">{t("item.requestDate")}: </span>
                  {dateFormatter.format(new Date(requestItem.createdAt))}
                </p>
                {requestItem.createdByUser ? (
                  <p>
                    <span className="font-medium">{t("item.requestedBy")}: </span>
                    {requestItem.createdByUser.name}
                  </p>
                ) : null}
                {requestItem.startDate ? (
                  <p>
                    <span className="font-medium">{t("columns.dates")}: </span>
                    {dateFormatter.format(new Date(requestItem.startDate))}
                    {requestItem.endDate
                      ? ` — ${dateFormatter.format(new Date(requestItem.endDate))}`
                      : ""}
                  </p>
                ) : null}
                <div className="pt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t("item.price")}:{" "}
                    {formatAmount(requestItem.displayedPrice, requestItem.currency, locale)} ×{" "}
                    {requestItem.screeningCount}
                  </p>
                  <p className="font-semibold text-base">
                    {formatAmount(
                      requestItem.displayedPrice * requestItem.screeningCount,
                      requestItem.currency,
                      locale
                    )}
                  </p>
                </div>
              </div>
            </div>

            {requestItem.status === "approved" ? (
              <div className="pt-2">
                <Button variant="outline" disabled className="w-full">
                  {t("actions.pay")}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
