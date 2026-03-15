"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchWalletPayouts } from "@/components/wallet/wallet-actions";
import { formatAmount } from "@/lib/pricing/format";

import type { WalletPayout } from "@/lib/services/wallet-service";

interface WalletPayoutsTableProps {
  initialPayouts: WalletPayout[];
  initialHasMore: boolean;
  initialNextCursor?: string;
}

interface PageData {
  payouts: WalletPayout[];
  hasMore: boolean;
  nextCursor?: string;
}

const STATUS_VARIANT: Record<
  WalletPayout["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  in_transit: "outline",
  paid: "default",
  failed: "destructive",
  canceled: "secondary",
};

export function WalletPayoutsTable({
  initialPayouts,
  initialHasMore,
  initialNextCursor,
}: WalletPayoutsTableProps) {
  const t = useTranslations("wallet.payouts");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const [pages, setPages] = useState<PageData[]>([
    {
      payouts: initialPayouts,
      hasMore: initialHasMore,
      nextCursor: initialNextCursor,
    },
  ]);

  const currentPage = pages[currentPageIndex];
  const payouts = currentPage?.payouts ?? [];
  const hasMore = currentPage?.hasMore ?? false;

  const handleNext = useCallback(() => {
    const page = pages[currentPageIndex];
    if (!page?.hasMore || !page.nextCursor) return;

    const nextIndex = currentPageIndex + 1;

    if (pages[nextIndex]) {
      setCurrentPageIndex(nextIndex);
      return;
    }

    startTransition(async () => {
      const result = await fetchWalletPayouts(page.nextCursor);
      if ("success" in result && result.success) {
        const newPage: PageData = {
          payouts: result.payouts,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor,
        };
        setPages((prev) => [...prev, newPage]);
        setCurrentPageIndex(nextIndex);
      }
    });
  }, [currentPageIndex, pages, startTransition]);

  const handlePrevious = useCallback(() => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  }, [currentPageIndex]);

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (payouts.length === 0 && !isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/35 border-border/60 hover:bg-muted/35">
              <TableHead className="text-foreground/85 w-[25%] py-3 text-xs tracking-wide uppercase">
                {t("columns.date")}
              </TableHead>
              <TableHead className="text-foreground/85 w-[25%] py-3 text-right text-xs tracking-wide uppercase">
                {t("columns.amount")}
              </TableHead>
              <TableHead className="text-foreground/85 w-[25%] py-3 text-xs tracking-wide uppercase">
                {t("columns.status")}
              </TableHead>
              <TableHead className="text-foreground/85 w-[25%] py-3 text-xs tracking-wide uppercase">
                {t("columns.arrivalDate")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`} className="border-b border-border/45">
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  </TableRow>
                ))
              : payouts.map((payout) => (
                  <TableRow key={payout.id} className="border-b border-border/45 hover:bg-muted/25">
                    <TableCell className="text-sm">{formatDate(payout.createdAt)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatAmount(payout.amount, payout.currency, locale)}
                    </TableCell>
                    <TableCell>
                      {payout.status === "failed" && payout.failureMessage ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant={STATUS_VARIANT[payout.status]}>
                                {t(`status.${payout.status}`)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{payout.failureMessage}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Badge variant={STATUS_VARIANT[payout.status]}>
                          {t(`status.${payout.status}`)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(payout.arrivalDate)}</TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>

        {(currentPageIndex > 0 || hasMore) && (
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={currentPageIndex === 0 || isPending}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t("previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={!hasMore || isPending}
            >
              {t("next")}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
