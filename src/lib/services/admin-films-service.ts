import { and, count, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts, filmPrices, films, orderItems, orders } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type FilmStatus = "active" | "inactive" | "retired";
type TmdbMatchStatus = "matched" | "pending" | "no_match" | "manual";

export interface AdminFilmRow {
  id: string;
  title: string;
  posterUrl: string | null;
  rightsHolderAccountId: string;
  rightsHolderName: string;
  releaseYear: number | null;
  status: FilmStatus;
  tmdbMatchStatus: TmdbMatchStatus | null;
  priceZoneCount: number;
  orderCount: number;
}

interface ListFilmsOptions {
  page: number;
  limit: number;
  search?: string;
  status?: FilmStatus;
  tmdbMatchStatus?: TmdbMatchStatus;
}

// ─── List films for admin ─────────────────────────────────────────────────────

export async function listFilmsForAdmin(options: ListFilmsOptions) {
  const { page, limit, search, status, tmdbMatchStatus } = options;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (status) {
    conditions.push(eq(films.status, status));
  }
  if (tmdbMatchStatus) {
    conditions.push(eq(films.tmdbMatchStatus, tmdbMatchStatus));
  }
  if (search?.trim()) {
    const searchTerm = `%${search.trim()}%`;
    conditions.push(
      sql`(
        ${films.title} ILIKE ${searchTerm}
        OR EXISTS (
          SELECT 1 FROM unnest(${films.directors}) AS d(name)
          WHERE d.name ILIKE ${searchTerm}
        )
      )`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: films.id,
        title: films.title,
        posterUrl: films.posterUrl,
        rightsHolderAccountId: films.accountId,
        rightsHolderName: sql<string>`(
          SELECT ${accounts.companyName} FROM ${accounts}
          WHERE ${accounts.id} = ${films.accountId}
        )`,
        releaseYear: films.releaseYear,
        status: films.status,
        tmdbMatchStatus: films.tmdbMatchStatus,
        priceZoneCount: sql<number>`(
          SELECT count(*)::int FROM ${filmPrices}
          WHERE ${filmPrices.filmId} = ${films.id}
        )`,
        orderCount: sql<number>`(
          SELECT count(*)::int FROM ${orderItems}
          WHERE ${orderItems.filmId} = ${films.id}
        )`,
      })
      .from(films)
      .where(whereClause)
      .orderBy(films.title)
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(films).where(whereClause),
  ]);

  return {
    films: rows as AdminFilmRow[],
    total: totalResult[0]?.count ?? 0,
  };
}

// ─── Film detail for admin ────────────────────────────────────────────────────

export interface AdminFilmOrderRow {
  orderId: string;
  orderNumber: number;
  exhibitorAccountId: string;
  exhibitorName: string;
  cinemaName: string;
  paidAt: Date;
  displayedPrice: number;
  timelessAmount: number;
  deliveryStatus: string;
  currency: string;
}

export interface AdminFilmDetail {
  film: {
    id: string;
    title: string;
    originalTitle: string | null;
    status: string;
    releaseYear: number | null;
    directors: string[] | null;
    genres: string[] | null;
    duration: number | null;
    posterUrl: string | null;
    rightsHolderAccountId: string;
    rightsHolderName: string;
    createdAt: Date;
  };
  orders: AdminFilmOrderRow[];
  totalVolume: number; // sum of displayedPrice in cents
  totalMargin: number; // sum of timelessAmount in cents
}

export async function getFilmDetailForAdmin(filmId: string): Promise<AdminFilmDetail | null> {
  const [filmRow] = await db
    .select({
      id: films.id,
      title: films.title,
      originalTitle: films.originalTitle,
      status: films.status,
      releaseYear: films.releaseYear,
      directors: films.directors,
      genres: films.genres,
      duration: films.duration,
      posterUrl: films.posterUrl,
      rightsHolderAccountId: films.accountId,
      rightsHolderName: sql<string>`(
        SELECT ${accounts.companyName} FROM ${accounts}
        WHERE ${accounts.id} = ${films.accountId}
      )`,
      createdAt: films.createdAt,
    })
    .from(films)
    .where(eq(films.id, filmId));

  if (!filmRow) return null;

  const orderRows = await db
    .select({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      exhibitorAccountId: orders.exhibitorAccountId,
      exhibitorName: sql<string>`(
        SELECT ${accounts.companyName} FROM ${accounts}
        WHERE ${accounts.id} = ${orders.exhibitorAccountId}
      )`,
      cinemaName: sql<string>`(
        SELECT c.name FROM cinemas c
        WHERE c.id = ${orderItems.cinemaId}
      )`,
      paidAt: orders.paidAt,
      displayedPrice: orderItems.displayedPrice,
      timelessAmount: orderItems.timelessAmount,
      deliveryStatus: orderItems.deliveryStatus,
      currency: orderItems.currency,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orderItems.filmId, filmId))
    .orderBy(orders.paidAt);

  const totalVolume = orderRows.reduce((sum, r) => sum + Number(r.displayedPrice), 0);
  const totalMargin = orderRows.reduce((sum, r) => sum + Number(r.timelessAmount), 0);

  return {
    film: filmRow,
    orders: orderRows as AdminFilmOrderRow[],
    totalVolume,
    totalMargin,
  };
}
