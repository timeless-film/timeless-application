import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { WalletDashboard } from "@/components/wallet/wallet-dashboard";
import { auth } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/auth/membership";
import {
  getPayoutHistory,
  getRevenueChart,
  getRevenueStats,
  getWalletBalance,
  getWalletTransactions,
} from "@/lib/services/wallet-service";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("wallet");
  return {
    title: t("title"),
  };
}

export default async function WalletPage() {
  const t = await getTranslations("wallet");

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const ctx = await getCurrentMembership();
  if (!ctx) return null;

  const stripeAccountId = ctx.account.stripeConnectAccountId;
  const isOnboarded = ctx.account.stripeConnectOnboardingComplete;

  // If Stripe Connect is not set up, show onboarding prompt
  if (!stripeAccountId || !isOnboarded) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-2xl">{t("title")}</h1>
        <p className="text-muted-foreground">{t("onboardingRequired")}</p>
      </div>
    );
  }

  // Fetch all data in parallel
  const [balance, revenueStats, chartResult, transactionsResult, payoutsResult] = await Promise.all(
    [
      getWalletBalance(stripeAccountId),
      getRevenueStats(ctx.account.id),
      getRevenueChart(ctx.account.id, "30d"),
      getWalletTransactions(stripeAccountId, ctx.account.id),
      getPayoutHistory(stripeAccountId),
    ]
  );

  return (
    <div className="space-y-4">
      <WalletDashboard
        title={t("title")}
        available={balance.available}
        pending={balance.pending}
        currentMonth={revenueStats.currentMonth}
        previousMonth={revenueStats.previousMonth}
        chartSeries={chartResult.series}
        chartSalesCounts={chartResult.salesCounts}
        transactions={transactionsResult.transactions}
        transactionsHasMore={transactionsResult.hasMore}
        transactionsNextCursor={transactionsResult.nextCursor}
        payouts={payoutsResult.payouts}
        payoutsHasMore={payoutsResult.hasMore}
        payoutsNextCursor={payoutsResult.nextCursor}
      />
    </div>
  );
}
