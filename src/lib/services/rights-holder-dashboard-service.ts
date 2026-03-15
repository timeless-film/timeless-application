import { and, count, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { filmEvents, films, orderItems, orders, requests } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RightsHolderDashboardKpis {
  revenueThisMonth: number; // sum of rightsHolderAmount * screeningCount in cents
  totalSales: number; // count of orderItems for this RH
  pendingRequests: number; // count of requests pending for this RH
  activeFilms: number; // count of active films
  filmViewsThisMonth: number; // film detail page views this month
  cartAdditionsThisMonth: number; // cart additions this month
}

export type RevenueGranularity = "day" | "week" | "month" | "year";
export type RevenuePeriod = "7d" | "30d" | "90d" | "12m" | "ytd" | "all";

export interface RevenuePoint {
  date: string;
  revenue: number; // in cents
}

export interface SalesPoint {
  date: string;
  count: number;
}

export interface TopFilm {
  filmId: string;
  title: string;
  posterUrl: string | null;
  orderCount: number;
  totalRevenue: number; // in cents (rightsHolderAmount * screeningCount)
}

export interface TopViewedFilm {
  filmId: string;
  title: string;
  posterUrl: string | null;
  viewCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── KPIs ─────────────────────────────────────────────────────────────────────

export async function getRightsHolderDashboardKpis(
  accountId: string
): Promise<RightsHolderDashboardKpis> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const revenueExpr = sql<number>`COALESCE(SUM(${orderItems.rightsHolderAmount} * ${orderItems.screeningCount}), 0)`;

  const [[revenueRow], [salesRow], [pendingReqRow], [filmsRow], [viewsRow], [cartAddsRow]] =
    await Promise.all([
      // Revenue this month
      db
        .select({ total: revenueExpr })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(
          and(
            eq(orderItems.rightsHolderAccountId, accountId),
            eq(orders.status, "paid"),
            gte(orders.paidAt, startOfMonth)
          )
        ),
      // Total sales (all time)
      db
        .select({ total: count() })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .where(and(eq(orderItems.rightsHolderAccountId, accountId), eq(orders.status, "paid"))),
      // Pending requests
      db
        .select({ total: count() })
        .from(requests)
        .where(and(eq(requests.rightsHolderAccountId, accountId), eq(requests.status, "pending"))),
      // Active films
      db
        .select({ total: count() })
        .from(films)
        .where(and(eq(films.accountId, accountId), eq(films.status, "active"))),
      // Film views this month (views on RH's films)
      db
        .select({ total: count() })
        .from(filmEvents)
        .innerJoin(films, eq(filmEvents.filmId, films.id))
        .where(
          and(
            eq(films.accountId, accountId),
            eq(filmEvents.eventType, "view"),
            gte(filmEvents.createdAt, startOfMonth)
          )
        ),
      // Cart additions this month
      db
        .select({ total: count() })
        .from(filmEvents)
        .innerJoin(films, eq(filmEvents.filmId, films.id))
        .where(
          and(
            eq(films.accountId, accountId),
            eq(filmEvents.eventType, "cart_add"),
            gte(filmEvents.createdAt, startOfMonth)
          )
        ),
    ]);

  return {
    revenueThisMonth: Number(revenueRow?.total ?? 0),
    totalSales: Number(salesRow?.total ?? 0),
    pendingRequests: Number(pendingReqRow?.total ?? 0),
    activeFilms: Number(filmsRow?.total ?? 0),
    filmViewsThisMonth: Number(viewsRow?.total ?? 0),
    cartAdditionsThisMonth: Number(cartAddsRow?.total ?? 0),
  };
}

// ─── Revenue over time ────────────────────────────────────────────────────────

export async function getRightsHolderRevenue(
  accountId: string,
  granularity: RevenueGranularity,
  period: RevenuePeriod
): Promise<RevenuePoint[]> {
  const format = GRANULARITY_FORMAT[granularity];
  const startDate = getPeriodStartDate(period);

  const dateExpr = sql`TO_CHAR(${orders.paidAt}, ${sql.raw(`'${format}'`)})`;

  const conditions = [eq(orderItems.rightsHolderAccountId, accountId), eq(orders.status, "paid")];
  if (startDate) conditions.push(gte(orders.paidAt, startDate));

  const rows = await db
    .select({
      date: sql<string>`${dateExpr}`,
      revenue: sql<number>`COALESCE(SUM(${orderItems.rightsHolderAmount} * ${orderItems.screeningCount}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(...conditions))
    .groupBy(dateExpr)
    .orderBy(dateExpr);

  return rows.map((r) => ({
    date: r.date,
    revenue: Number(r.revenue),
  }));
}

// ─── Sales over time ──────────────────────────────────────────────────────────

export async function getRightsHolderSales(
  accountId: string,
  granularity: RevenueGranularity,
  period: RevenuePeriod
): Promise<SalesPoint[]> {
  const format = GRANULARITY_FORMAT[granularity];
  const startDate = getPeriodStartDate(period);

  const dateExpr = sql`TO_CHAR(${orders.paidAt}, ${sql.raw(`'${format}'`)})`;

  const conditions = [eq(orderItems.rightsHolderAccountId, accountId), eq(orders.status, "paid")];
  if (startDate) conditions.push(gte(orders.paidAt, startDate));

  const rows = await db
    .select({
      date: sql<string>`${dateExpr}`,
      count: count(),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(...conditions))
    .groupBy(dateExpr)
    .orderBy(dateExpr);

  return rows.map((r) => ({
    date: r.date,
    count: Number(r.count),
  }));
}

// ─── Top films ────────────────────────────────────────────────────────────────

export async function getRightsHolderTopFilms(
  accountId: string,
  period: RevenuePeriod,
  limit = 5
): Promise<TopFilm[]> {
  const startDate = getPeriodStartDate(period);

  const conditions = [eq(orderItems.rightsHolderAccountId, accountId), eq(orders.status, "paid")];
  if (startDate) conditions.push(gte(orders.paidAt, startDate));

  const rows = await db
    .select({
      filmId: orderItems.filmId,
      title: films.title,
      posterUrl: films.posterUrl,
      orderCount: count(),
      totalRevenue: sql<number>`COALESCE(SUM(${orderItems.rightsHolderAmount} * ${orderItems.screeningCount}), 0)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(films, eq(orderItems.filmId, films.id))
    .where(and(...conditions))
    .groupBy(orderItems.filmId, films.id, films.title, films.posterUrl)
    .orderBy(
      sql`COALESCE(SUM(${orderItems.rightsHolderAmount} * ${orderItems.screeningCount}), 0) DESC`
    )
    .limit(limit);

  return rows.map((r) => ({
    filmId: r.filmId,
    title: r.title,
    posterUrl: r.posterUrl,
    orderCount: Number(r.orderCount),
    totalRevenue: Number(r.totalRevenue),
  }));
}

export async function getRightsHolderTopViewedFilms(
  accountId: string,
  period: RevenuePeriod,
  limit = 5
): Promise<TopViewedFilm[]> {
  const startDate = getPeriodStartDate(period);
  const viewCountExpr = count();

  const conditions = [eq(films.accountId, accountId), eq(filmEvents.eventType, "view")];
  if (startDate) conditions.push(gte(filmEvents.createdAt, startDate));

  const rows = await db
    .select({
      filmId: filmEvents.filmId,
      title: films.title,
      posterUrl: films.posterUrl,
      viewCount: viewCountExpr,
    })
    .from(filmEvents)
    .innerJoin(films, eq(filmEvents.filmId, films.id))
    .where(and(...conditions))
    .groupBy(filmEvents.filmId, films.id, films.title, films.posterUrl)
    .orderBy(desc(viewCountExpr))
    .limit(limit);

  return rows.map((row) => ({
    filmId: row.filmId,
    title: row.title,
    posterUrl: row.posterUrl,
    viewCount: Number(row.viewCount),
  }));
}
