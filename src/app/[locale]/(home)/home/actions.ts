"use server";

import { getCurrentMembership } from "@/lib/auth/membership";
import {
  getRightsHolderDashboardKpis,
  getRightsHolderRevenue,
  getRightsHolderSales,
  getRightsHolderTopFilms,
  getRightsHolderTopViewedFilms,
} from "@/lib/services/rights-holder-dashboard-service";

import type {
  RevenueGranularity,
  RevenuePeriod,
  RevenuePoint,
  RightsHolderDashboardKpis,
  SalesPoint,
  TopFilm,
  TopViewedFilm,
} from "@/lib/services/rights-holder-dashboard-service";

const VALID_GRANULARITIES: RevenueGranularity[] = ["day", "week", "month", "year"];
const VALID_PERIODS: RevenuePeriod[] = ["7d", "30d", "90d", "12m", "ytd", "all"];

interface RightsHolderDashboardData {
  kpis: RightsHolderDashboardKpis;
  revenue: RevenuePoint[];
  sales: SalesPoint[];
  topFilms: TopFilm[];
  topViewedFilms: TopViewedFilm[];
}

export async function getRightsHolderDashboardDataAction(
  granularity: RevenueGranularity,
  period: RevenuePeriod
): Promise<{ data: RightsHolderDashboardData } | { error: string }> {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" };
  if (ctx.account.type !== "rights_holder") return { error: "FORBIDDEN" };

  if (!VALID_GRANULARITIES.includes(granularity)) return { error: "INVALID_INPUT" };
  if (!VALID_PERIODS.includes(period)) return { error: "INVALID_INPUT" };

  const accountId = ctx.account.id;

  const [kpis, revenue, sales, topFilms, topViewedFilms] = await Promise.all([
    getRightsHolderDashboardKpis(accountId),
    getRightsHolderRevenue(accountId, granularity, period),
    getRightsHolderSales(accountId, granularity, period),
    getRightsHolderTopFilms(accountId, period),
    getRightsHolderTopViewedFilms(accountId, period),
  ]);

  return { data: { kpis, revenue, sales, topFilms, topViewedFilms } };
}
