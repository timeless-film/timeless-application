"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CsvExportButton } from "@/components/wallet/csv-export-button";
import { WalletKpiCards } from "@/components/wallet/wallet-kpi-cards";
import { WalletPayoutsTable } from "@/components/wallet/wallet-payouts-table";
import { WalletRevenueChart } from "@/components/wallet/wallet-revenue-chart";
import { WalletTransactionsTable } from "@/components/wallet/wallet-transactions-table";
import { WithdrawDialog } from "@/components/wallet/withdraw-dialog";

import type {
  AmountByCurrency,
  RevenueChartSeries,
  SalesCountPoint,
  WalletPayout,
  WalletTransaction,
} from "@/lib/services/wallet-service";

interface WalletDashboardProps {
  title: string;
  available: AmountByCurrency[];
  pending: AmountByCurrency[];
  currentMonth: AmountByCurrency[];
  previousMonth: AmountByCurrency[];
  chartSeries: RevenueChartSeries[];
  chartSalesCounts: SalesCountPoint[];
  transactions: WalletTransaction[];
  transactionsHasMore: boolean;
  transactionsNextCursor?: string;
  payouts: WalletPayout[];
  payoutsHasMore: boolean;
  payoutsNextCursor?: string;
}

export function WalletDashboard({
  title,
  available,
  pending,
  currentMonth,
  previousMonth,
  chartSeries,
  chartSalesCounts,
  transactions,
  transactionsHasMore,
  transactionsNextCursor,
  payouts,
  payoutsHasMore,
  payoutsNextCursor,
}: WalletDashboardProps) {
  const t = useTranslations("wallet");
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">{title}</h1>
        <div className="flex gap-2">
          <CsvExportButton />
          <Button size="sm" onClick={() => setWithdrawOpen(true)}>
            {t("withdraw")}
          </Button>
        </div>
      </div>

      <WalletKpiCards
        available={available}
        pending={pending}
        currentMonth={currentMonth}
        previousMonth={previousMonth}
      />

      <WalletRevenueChart initialSeries={chartSeries} initialSalesCounts={chartSalesCounts} />

      <WalletTransactionsTable
        initialTransactions={transactions}
        initialHasMore={transactionsHasMore}
        initialNextCursor={transactionsNextCursor}
      />

      <WalletPayoutsTable
        initialPayouts={payouts}
        initialHasMore={payoutsHasMore}
        initialNextCursor={payoutsNextCursor}
      />

      <WithdrawDialog available={available} open={withdrawOpen} onOpenChange={setWithdrawOpen} />
    </div>
  );
}
