"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";

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
import { fetchWalletTransactions } from "@/components/wallet/wallet-actions";
import { formatAmount } from "@/lib/pricing/format";

import type { WalletTransaction } from "@/lib/services/wallet-service";

interface WalletTransactionsTableProps {
  initialTransactions: WalletTransaction[];
  initialHasMore: boolean;
  initialNextCursor?: string;
}

interface PageData {
  transactions: WalletTransaction[];
  hasMore: boolean;
  nextCursor?: string;
}

export function WalletTransactionsTable({
  initialTransactions,
  initialHasMore,
  initialNextCursor,
}: WalletTransactionsTableProps) {
  const t = useTranslations("wallet.transactions");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // Cache loaded pages in state for forward/back navigation
  const [pages, setPages] = useState<PageData[]>([
    {
      transactions: initialTransactions,
      hasMore: initialHasMore,
      nextCursor: initialNextCursor,
    },
  ]);

  const currentPage = pages[currentPageIndex];
  const transactions = currentPage?.transactions ?? [];
  const hasMore = currentPage?.hasMore ?? false;

  const handleNext = useCallback(() => {
    const page = pages[currentPageIndex];
    if (!page?.hasMore || !page.nextCursor) return;

    const nextIndex = currentPageIndex + 1;

    // If already cached, just navigate
    if (pages[nextIndex]) {
      setCurrentPageIndex(nextIndex);
      return;
    }

    startTransition(async () => {
      const result = await fetchWalletTransactions(page.nextCursor);
      if ("success" in result && result.success) {
        const newPage: PageData = {
          transactions: result.transactions,
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

  if (transactions.length === 0 && !isPending) {
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
              <TableHead className="text-foreground/85 w-[18%] py-3 text-xs tracking-wide uppercase">
                {t("columns.date")}
              </TableHead>
              <TableHead className="text-foreground/85 w-[26%] py-3 text-xs tracking-wide uppercase">
                {t("columns.film")}
              </TableHead>
              <TableHead className="text-foreground/85 hidden w-[16%] py-3 text-xs tracking-wide uppercase md:table-cell">
                {t("columns.cinema")}
              </TableHead>
              <TableHead className="text-foreground/85 hidden w-[12%] py-3 text-xs tracking-wide uppercase lg:table-cell">
                {t("columns.orderNumber")}
              </TableHead>
              <TableHead className="text-foreground/85 hidden w-[10%] py-3 text-right text-xs tracking-wide uppercase lg:table-cell">
                {t("columns.ht")}
              </TableHead>
              <TableHead className="text-foreground/85 hidden w-[8%] py-3 text-right text-xs tracking-wide uppercase lg:table-cell">
                {t("columns.vat")}
              </TableHead>
              <TableHead className="text-foreground/85 w-[10%] py-3 text-right text-xs tracking-wide uppercase">
                {t("columns.transferred")}
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
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="ml-auto h-4 w-14" />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-4 w-16" />
                    </TableCell>
                  </TableRow>
                ))
              : transactions.map((tx) => (
                  <TableRow key={tx.id} className="border-b border-border/45 hover:bg-muted/25">
                    <TableCell className="text-sm">{formatDate(tx.date)}</TableCell>
                    <TableCell className="font-heading truncate text-sm">{tx.filmTitle}</TableCell>
                    <TableCell className="hidden truncate text-sm md:table-cell">
                      {tx.cinemaName}
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">{tx.orderNumber}</TableCell>
                    <TableCell className="hidden text-right text-sm lg:table-cell">
                      {formatAmount(tx.netAmount, tx.currency, locale)}
                    </TableCell>
                    <TableCell className="hidden text-right text-sm lg:table-cell">
                      {formatAmount(tx.taxAmount, tx.currency, locale)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatAmount(tx.netAmount + tx.taxAmount, tx.currency, locale)}
                    </TableCell>
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
