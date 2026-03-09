"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useTransition } from "react";
import { toast } from "sonner";

import { cancelRequest, relaunchRequest } from "@/components/booking/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RequestItem {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "paid" | string;
  startDate: string | null;
  endDate: string | null;
  film: { title: string };
  rightsHolderAccount: { companyName: string | null };
  cinema: { name: string };
  room: { name: string };
}

interface RequestsPageContentProps {
  requests: RequestItem[];
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
    return <p className="text-muted-foreground">{t("title")}: 0</p>;
  }

  return (
    <div className="space-y-3">
      {requests.map((requestItem) => (
        <Card key={requestItem.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{requestItem.film.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">{t("columns.rightsHolder")}: </span>
              {requestItem.rightsHolderAccount.companyName ?? "-"}
            </p>
            <p>
              <span className="font-medium">{t("columns.cinema")}: </span>
              {requestItem.cinema.name} - {requestItem.room.name}
            </p>
            <p>
              <span className="font-medium">{t("columns.status")}: </span>
              {statusLabel(requestItem.status)}
            </p>
            {requestItem.startDate ? (
              <p>
                <span className="font-medium">{t("columns.dates")}: </span>
                {dateFormatter.format(new Date(requestItem.startDate))}
                {requestItem.endDate
                  ? ` - ${dateFormatter.format(new Date(requestItem.endDate))}`
                  : ""}
              </p>
            ) : null}

            <div className="flex gap-2 pt-2">
              {requestItem.status === "pending" ? (
                <Button
                  variant="outline"
                  disabled={isPending}
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
                >
                  {t("actions.cancel")}
                </Button>
              ) : null}

              {(requestItem.status === "cancelled" || requestItem.status === "rejected") && (
                <Button
                  variant="secondary"
                  disabled={isPending}
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
                >
                  {t("actions.resubmit")}
                </Button>
              )}

              {requestItem.status === "approved" ? (
                <Button variant="outline" disabled>
                  {t("actions.pay")}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
