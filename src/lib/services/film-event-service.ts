import { and, count, eq, gte, sql, sum } from "drizzle-orm";

import { db } from "@/lib/db";
import { filmEvents, orderItems, requests } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelinePoint {
  date: string;
  views: number;
  cartAdds: number;
}

export interface FilmEventStats {
  totalViews: number;
  totalCartAdds: number;
  totalRequests: number;
  totalRevenue: number;
  timeline: TimelinePoint[];
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

export async function trackFilmEvent(
  filmId: string,
  accountId: string,
  eventType: "view" | "cart_add"
): Promise<void> {
  try {
    await db.insert(filmEvents).values({
      filmId,
      accountId,
      eventType,
    });
  } catch (error) {
    // Log but don't fail the main operation — tracking is non-critical
    console.error("Failed to track film event:", error);
  }
}

// ─── Single-film stats ───────────────────────────────────────────────────────

export async function getFilmEventStats(
  filmId: string,
  days: number = 30
): Promise<FilmEventStats> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const [viewsResult, cartAddsResult, requestsResult, revenueResult] = await Promise.all([
    db
      .select({ total: count() })
      .from(filmEvents)
      .where(and(eq(filmEvents.filmId, filmId), eq(filmEvents.eventType, "view"))),
    db
      .select({ total: count() })
      .from(filmEvents)
      .where(and(eq(filmEvents.filmId, filmId), eq(filmEvents.eventType, "cart_add"))),
    db.select({ total: count() }).from(requests).where(eq(requests.filmId, filmId)),
    db
      .select({ total: sum(orderItems.displayedPrice).as("total") })
      .from(orderItems)
      .where(eq(orderItems.filmId, filmId)),
  ]);

  // Timeline — views + cart_adds per day over the period
  const timeline = await db
    .select({
      date: sql<string>`DATE(${filmEvents.createdAt})`.as("date"),
      views: sql<number>`COUNT(*) FILTER (WHERE ${filmEvents.eventType} = 'view')`.as("views"),
      cartAdds: sql<number>`COUNT(*) FILTER (WHERE ${filmEvents.eventType} = 'cart_add')`.as(
        "cart_adds"
      ),
    })
    .from(filmEvents)
    .where(and(eq(filmEvents.filmId, filmId), gte(filmEvents.createdAt, sinceDate)))
    .groupBy(sql`DATE(${filmEvents.createdAt})`)
    .orderBy(sql`DATE(${filmEvents.createdAt})`);

  return {
    totalViews: viewsResult[0]?.total ?? 0,
    totalCartAdds: cartAddsResult[0]?.total ?? 0,
    totalRequests: requestsResult[0]?.total ?? 0,
    totalRevenue: Number(revenueResult[0]?.total ?? 0),
    timeline: timeline.map((point) => ({
      date: point.date,
      views: Number(point.views),
      cartAdds: Number(point.cartAdds),
    })),
  };
}
