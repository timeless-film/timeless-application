import { and, count, eq, gte, sql, sum } from "drizzle-orm";

import { db } from "@/lib/db";
import { filmEvents, filmPrices, films, orderItems, requests, searchEvents } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsFilters {
  status?: string;
  type?: string;
  region?: string;
  period?: string;
}

interface AnalyticsPagination {
  page: number;
  limit: number;
}

interface AnalyticsSort {
  field: string;
  order: "asc" | "desc";
}

interface FilmAnalytics {
  id: string;
  accountId: string;
  title: string;
  status: string;
  type: string;
  countries: string[] | null;
  views: number;
  addsToCart: number;
  requests: number;
  revenue: number;
  priceZones: Array<{ countries: string[]; price: number; currency: string }>;
}

interface TimelinePoint {
  date: string;
  views: number;
  revenue: number;
}

export interface AnalyticsResult {
  kpis: {
    totalViews: number;
    totalAddsToCart: number;
    totalRequests: number;
    totalRevenue: number;
  };
  films: FilmAnalytics[];
  topSearches: Array<{ query: string; count: number }>;
  topFilters: Array<{ filters: unknown; count: number }>;
  timeline: TimelinePoint[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function getFilmAnalytics(
  rightsHolderAccountId: string,
  analyticsFilters: AnalyticsFilters,
  pagination: AnalyticsPagination,
  sort: AnalyticsSort
): Promise<AnalyticsResult> {
  // Build base film filter conditions
  const filmConditions = [eq(films.accountId, rightsHolderAccountId)];

  if (analyticsFilters.status) {
    // SAFETY: Drizzle parameterizes the value, preventing SQL injection
    filmConditions.push(sql`${films.status} = ${analyticsFilters.status}`);
  }

  if (analyticsFilters.type) {
    // SAFETY: Drizzle parameterizes the value
    filmConditions.push(sql`${films.type} = ${analyticsFilters.type}`);
  }

  if (analyticsFilters.region) {
    filmConditions.push(sql`${analyticsFilters.region} = ANY(${films.countries})`);
  }

  const filmFilter = and(...filmConditions);

  // Get matching film IDs for scoping
  const matchingFilms = await db
    .select({
      id: films.id,
      accountId: films.accountId,
      title: films.title,
      status: films.status,
      type: films.type,
      countries: films.countries,
    })
    .from(films)
    .where(filmFilter);

  const filmIds = matchingFilms.map((f) => f.id);
  const total = filmIds.length;

  // Aggregate views per film
  const viewCounts =
    filmIds.length > 0
      ? await db
          .select({
            filmId: filmEvents.filmId,
            count: count().as("count"),
          })
          .from(filmEvents)
          .where(and(sql`${filmEvents.filmId} IN ${filmIds}`, eq(filmEvents.eventType, "view")))
          .groupBy(filmEvents.filmId)
      : [];

  // Aggregate cart additions per film
  const cartCounts =
    filmIds.length > 0
      ? await db
          .select({
            filmId: filmEvents.filmId,
            count: count().as("count"),
          })
          .from(filmEvents)
          .where(and(sql`${filmEvents.filmId} IN ${filmIds}`, eq(filmEvents.eventType, "cart_add")))
          .groupBy(filmEvents.filmId)
      : [];

  // Aggregate requests per film
  const requestCounts =
    filmIds.length > 0
      ? await db
          .select({
            filmId: requests.filmId,
            count: count().as("count"),
          })
          .from(requests)
          .where(sql`${requests.filmId} IN ${filmIds}`)
          .groupBy(requests.filmId)
      : [];

  // Aggregate revenue per film from order items
  const revenueSums =
    filmIds.length > 0
      ? await db
          .select({
            filmId: orderItems.filmId,
            total: sum(orderItems.rightsHolderAmount).as("total"),
          })
          .from(orderItems)
          .where(
            and(
              sql`${orderItems.filmId} IN ${filmIds}`,
              eq(orderItems.rightsHolderAccountId, rightsHolderAccountId)
            )
          )
          .groupBy(orderItems.filmId)
      : [];

  // Get price zones per film
  const priceZones =
    filmIds.length > 0
      ? await db
          .select({
            filmId: filmPrices.filmId,
            countries: filmPrices.countries,
            price: filmPrices.price,
            currency: filmPrices.currency,
          })
          .from(filmPrices)
          .where(sql`${filmPrices.filmId} IN ${filmIds}`)
      : [];

  // Build lookup maps
  const viewMap = new Map(viewCounts.map((v) => [v.filmId, v.count]));
  const cartMap = new Map(cartCounts.map((c) => [c.filmId, c.count]));
  const requestMap = new Map(requestCounts.map((r) => [r.filmId, r.count]));
  const revenueMap = new Map(revenueSums.map((r) => [r.filmId, Number(r.total) || 0]));
  const priceZoneMap = new Map<
    string,
    Array<{ countries: string[]; price: number; currency: string }>
  >();
  for (const pz of priceZones) {
    const existing = priceZoneMap.get(pz.filmId) ?? [];
    existing.push({
      countries: pz.countries,
      price: pz.price,
      currency: pz.currency,
    });
    priceZoneMap.set(pz.filmId, existing);
  }

  // Build film analytics
  const filmAnalytics: FilmAnalytics[] = matchingFilms.map((f) => ({
    id: f.id,
    accountId: f.accountId,
    title: f.title,
    status: f.status,
    type: f.type,
    countries: f.countries,
    views: viewMap.get(f.id) ?? 0,
    addsToCart: cartMap.get(f.id) ?? 0,
    requests: requestMap.get(f.id) ?? 0,
    revenue: revenueMap.get(f.id) ?? 0,
    priceZones: priceZoneMap.get(f.id) ?? [],
  }));

  // Sort
  const sortDirection = sort.order === "desc" ? -1 : 1;
  filmAnalytics.sort((a, b) => {
    const aVal = getSortValue(a, sort.field);
    const bVal = getSortValue(b, sort.field);
    return (aVal - bVal) * sortDirection;
  });

  // Paginate
  const offset = (pagination.page - 1) * pagination.limit;
  const paginatedFilms = filmAnalytics.slice(offset, offset + pagination.limit);

  // Compute KPIs from all matching films (not just paginated)
  const kpis = {
    totalViews: filmAnalytics.reduce((sum, f) => sum + f.views, 0),
    totalAddsToCart: filmAnalytics.reduce((sum, f) => sum + f.addsToCart, 0),
    totalRequests: filmAnalytics.reduce((sum, f) => sum + f.requests, 0),
    totalRevenue: filmAnalytics.reduce((sum, f) => sum + f.revenue, 0),
  };

  // Top searches (global - not scoped to rights holder films)
  const topSearches = await getTopSearches();

  // Top filters (global)
  const topFilters = await getTopFilters();

  // Timeline
  const timeline = await getTimeline(filmIds, analyticsFilters.period);

  return {
    kpis,
    films: paginatedFilms,
    topSearches,
    topFilters,
    timeline,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSortValue(film: FilmAnalytics, field: string): number {
  switch (field) {
    case "revenue":
      return film.revenue;
    case "views":
      return film.views;
    case "requests":
      return film.requests;
    case "addsToCart":
      return film.addsToCart;
    default:
      return 0;
  }
}

async function getTopSearches(): Promise<Array<{ query: string; count: number }>> {
  const results = await db
    .select({
      query: searchEvents.searchTerm,
      count: count().as("count"),
    })
    .from(searchEvents)
    .where(sql`${searchEvents.searchTerm} IS NOT NULL AND ${searchEvents.searchTerm} != ''`)
    .groupBy(searchEvents.searchTerm)
    .orderBy(sql`count DESC`)
    .limit(10);

  return results.map((r) => ({
    query: r.query ?? "",
    count: r.count,
  }));
}

async function getTopFilters(): Promise<Array<{ filters: unknown; count: number }>> {
  const results = await db
    .select({
      filters: searchEvents.filters,
      count: count().as("count"),
    })
    .from(searchEvents)
    .where(sql`${searchEvents.filters} IS NOT NULL`)
    .groupBy(searchEvents.filters)
    .orderBy(sql`count DESC`)
    .limit(10);

  return results.map((r) => ({
    filters: r.filters,
    count: r.count,
  }));
}

async function getTimeline(filmIds: string[], period?: string): Promise<TimelinePoint[]> {
  const days = period === "7days" ? 7 : period === "90days" ? 90 : 30;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  if (filmIds.length === 0) {
    return [];
  }

  // Views per day
  const viewTimeline = await db
    .select({
      date: sql<string>`DATE(${filmEvents.createdAt})`.as("date"),
      views: count().as("views"),
    })
    .from(filmEvents)
    .where(
      and(
        sql`${filmEvents.filmId} IN ${filmIds}`,
        eq(filmEvents.eventType, "view"),
        gte(filmEvents.createdAt, sinceDate)
      )
    )
    .groupBy(sql`DATE(${filmEvents.createdAt})`)
    .orderBy(sql`DATE(${filmEvents.createdAt})`);

  // Revenue per day
  const revenueTimeline = await db
    .select({
      date: sql<string>`DATE(${orderItems.createdAt})`.as("date"),
      revenue: sum(orderItems.rightsHolderAmount).as("revenue"),
    })
    .from(orderItems)
    .where(and(sql`${orderItems.filmId} IN ${filmIds}`, gte(orderItems.createdAt, sinceDate)))
    .groupBy(sql`DATE(${orderItems.createdAt})`)
    .orderBy(sql`DATE(${orderItems.createdAt})`);

  // Merge timelines
  const revenueMap = new Map(revenueTimeline.map((r) => [r.date, Number(r.revenue) || 0]));

  return viewTimeline.map((point) => ({
    date: point.date,
    views: point.views,
    revenue: revenueMap.get(point.date) ?? 0,
  }));
}
