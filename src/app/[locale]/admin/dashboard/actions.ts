"use server";

import { getCurrentMembership } from "@/lib/auth/membership";
import {
  getDashboardKpis,
  getOrdersOverTime,
  getRevenue,
  getTopFilms,
} from "@/lib/services/admin-dashboard-service";

import type {
  DashboardKpis,
  OrdersPoint,
  RevenueGranularity,
  RevenuePeriod,
  RevenuePoint,
  TopFilm,
} from "@/lib/services/admin-dashboard-service";

const VALID_GRANULARITIES: RevenueGranularity[] = ["day", "week", "month", "year"];
const VALID_PERIODS: RevenuePeriod[] = ["7d", "30d", "90d", "12m", "ytd", "all"];

interface DashboardData {
  kpis: DashboardKpis;
  revenue: RevenuePoint[];
  ordersOverTime: OrdersPoint[];
  topFilms: TopFilm[];
}

export async function getDashboardDataAction(
  granularity: RevenueGranularity,
  period: RevenuePeriod
): Promise<{ data: DashboardData } | { error: string }> {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" };

  if (!VALID_GRANULARITIES.includes(granularity)) return { error: "INVALID_INPUT" };
  if (!VALID_PERIODS.includes(period)) return { error: "INVALID_INPUT" };

  const [kpis, revenue, ordersOverTime, topFilms] = await Promise.all([
    getDashboardKpis(period),
    getRevenue(granularity, period),
    getOrdersOverTime(granularity, period),
    getTopFilms(period),
  ]);

  return { data: { kpis, revenue, ordersOverTime, topFilms } };
}
