import { and, count, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts, films, orderItems, orders, requests } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardKpis {
  businessVolume: number; // sum of order subtotals (excl. VAT) in cents
  timelessMargin: number; // sum of timelessAmount from orderItems in cents
  ordersCount: number;
  pendingRequests: number;
  pendingDeliveries: number;
  activeExhibitors: number;
  activeRightsHolders: number;
  activeFilms: number;
  pendingOnboardings: number;
}

export interface MonthlyRevenuePoint {
  month: string; // YYYY-MM
  revenue: number; // in cents
}

export type RevenueGranularity = "day" | "week" | "month" | "year";
export type RevenuePeriod = "7d" | "30d" | "90d" | "12m" | "ytd" | "all";

export interface RevenuePoint {
  date: string; // YYYY-MM-DD, YYYY-WXX, YYYY-MM, or YYYY depending on granularity
  revenue: number; // in cents
}

export interface OrdersPoint {
  date: string;
  count: number;
}

export interface TopFilm {
  filmId: string;
  title: string;
  posterUrl: string | null;
  rightsHolderAccountId: string;
  rightsHolderName: string;
  orderCount: number;
  totalVolume: number; // in cents (sum of displayedPrice)
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export async function getDashboardKpis(period: RevenuePeriod = "12m"): Promise<DashboardKpis> {
  const startDate = getPeriodStartDate(period);

  const [
    [volumeRow],
    [marginRow],
    [ordersRow],
    [pendingReqRow],
    [pendingDeliveryRow],
    [exhibitorsRow],
    [rhRow],
    [filmsRow],
    [onboardingRow],
  ] = await Promise.all([
    // Business volume in period (subtotal from orders = excl. VAT)
    db
      .select({
        total: sql<number>`COALESCE(SUM(${orders.subtotal}), 0)`,
      })
      .from(orders)
      .where(
        startDate
          ? and(gte(orders.paidAt, startDate), eq(orders.status, "paid"))
          : eq(orders.status, "paid")
      ),
    // Timeless margin in period (timelessAmount from orderItems on paid orders)
    db
      .select({
        total: sql<number>`COALESCE(SUM(${orderItems.timelessAmount}), 0)`,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        startDate
          ? and(gte(orders.paidAt, startDate), eq(orders.status, "paid"))
          : eq(orders.status, "paid")
      ),
    // Orders in period
    db
      .select({ total: count() })
      .from(orders)
      .where(startDate ? gte(orders.paidAt, startDate) : undefined),
    // Pending requests
    db.select({ total: count() }).from(requests).where(eq(requests.status, "pending")),
    // Pending deliveries
    db.select({ total: count() }).from(orderItems).where(eq(orderItems.deliveryStatus, "pending")),
    // Active exhibitors
    db
      .select({ total: count() })
      .from(accounts)
      .where(and(eq(accounts.type, "exhibitor"), eq(accounts.status, "active"))),
    // Active rights holders
    db
      .select({ total: count() })
      .from(accounts)
      .where(and(eq(accounts.type, "rights_holder"), eq(accounts.status, "active"))),
    // Active films
    db.select({ total: count() }).from(films).where(eq(films.status, "active")),
    // Pending onboardings
    db.select({ total: count() }).from(accounts).where(eq(accounts.onboardingCompleted, false)),
  ]);

  return {
    businessVolume: Number(volumeRow?.total ?? 0),
    timelessMargin: Number(marginRow?.total ?? 0),
    ordersCount: Number(ordersRow?.total ?? 0),
    pendingRequests: Number(pendingReqRow?.total ?? 0),
    pendingDeliveries: Number(pendingDeliveryRow?.total ?? 0),
    activeExhibitors: Number(exhibitorsRow?.total ?? 0),
    activeRightsHolders: Number(rhRow?.total ?? 0),
    activeFilms: Number(filmsRow?.total ?? 0),
    pendingOnboardings: Number(onboardingRow?.total ?? 0),
  };
}

// ─── Monthly revenue (last 12 months) ─────────────────────────────────────────

export async function getMonthlyRevenue(): Promise<MonthlyRevenuePoint[]> {
  const rows = await db
    .select({
      month: sql<string>`TO_CHAR(${orders.paidAt}, 'YYYY-MM')`,
      revenue: sql<number>`COALESCE(SUM(${orderItems.timelessAmount}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(gte(orders.paidAt, sql`NOW() - INTERVAL '12 months'`))
    .groupBy(sql`TO_CHAR(${orders.paidAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${orders.paidAt}, 'YYYY-MM')`);

  return rows.map((r) => ({
    month: r.month,
    revenue: Number(r.revenue),
  }));
}

// ─── Flexible revenue query ───────────────────────────────────────────────────

const GRANULARITY_FORMAT: Record<RevenueGranularity, string> = {
  day: "YYYY-MM-DD",
  week: 'IYYY-"W"IW',
  month: "YYYY-MM",
  year: "YYYY",
};

function getPeriodStartDate(period: RevenuePeriod): Date | null {
  const now = new Date();
  switch (period) {
    case "7d":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    case "30d":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    case "90d":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
    case "12m":
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case "ytd":
      return new Date(now.getFullYear(), 0, 1);
    case "all":
      return null;
  }
}

export async function getRevenue(
  granularity: RevenueGranularity,
  period: RevenuePeriod
): Promise<RevenuePoint[]> {
  const format = GRANULARITY_FORMAT[granularity];
  const startDate = getPeriodStartDate(period);

  const conditions = startDate ? gte(orders.paidAt, startDate) : undefined;

  const dateExpr = sql`TO_CHAR(${orders.paidAt}, ${sql.raw(`'${format}'`)})`;

  const rows = await db
    .select({
      date: sql<string>`${dateExpr}`,
      revenue: sql<number>`COALESCE(SUM(${orderItems.timelessAmount}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(conditions)
    .groupBy(dateExpr)
    .orderBy(dateExpr);

  return rows.map((r) => ({
    date: r.date,
    revenue: Number(r.revenue),
  }));
}

// ─── Orders over time ─────────────────────────────────────────────────────────

export async function getOrdersOverTime(
  granularity: RevenueGranularity,
  period: RevenuePeriod
): Promise<OrdersPoint[]> {
  const format = GRANULARITY_FORMAT[granularity];
  const startDate = getPeriodStartDate(period);

  const conditions = startDate ? gte(orders.paidAt, startDate) : undefined;

  const dateExpr = sql`TO_CHAR(${orders.paidAt}, ${sql.raw(`'${format}'`)})`;

  const rows = await db
    .select({
      date: sql<string>`${dateExpr}`,
      count: count(),
    })
    .from(orders)
    .where(conditions)
    .groupBy(dateExpr)
    .orderBy(dateExpr);

  return rows.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));
}

// ─── Top films ────────────────────────────────────────────────────────────────

export async function getTopFilms(period: RevenuePeriod, limit = 10): Promise<TopFilm[]> {
  const startDate = getPeriodStartDate(period);

  const conditions = startDate
    ? and(gte(orders.paidAt, startDate), eq(orders.status, "paid"))
    : eq(orders.status, "paid");

  const rows = await db
    .select({
      filmId: orderItems.filmId,
      title: films.title,
      posterUrl: films.posterUrl,
      rightsHolderAccountId: films.accountId,
      rightsHolderName: sql<string>`(
        SELECT ${accounts.companyName} FROM ${accounts}
        WHERE ${accounts.id} = ${films.accountId}
      )`,
      orderCount: count(),
      totalVolume: sql<number>`COALESCE(SUM(${orderItems.displayedPrice}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(films, eq(orderItems.filmId, films.id))
    .where(conditions)
    .groupBy(orderItems.filmId, films.id, films.title, films.posterUrl, films.accountId)
    .orderBy(desc(count()))
    .limit(limit);

  return rows.map((r) => ({
    filmId: r.filmId,
    title: r.title,
    posterUrl: r.posterUrl,
    rightsHolderAccountId: String(r.rightsHolderAccountId),
    rightsHolderName: r.rightsHolderName,
    orderCount: Number(r.orderCount),
    totalVolume: Number(r.totalVolume),
  }));
}
