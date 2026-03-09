import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { cartItems, orders, orderItems, requests, filmPrices } from "@/lib/db/schema";

export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled" | "paid";

export interface DateValidationResult {
  success: boolean;
  errorCode?: "START_DATE_REQUIRED" | "INVALID_START_DATE" | "INVALID_END_DATE";
}

export function validateBookingDates(input: {
  startDate?: string;
  endDate?: string;
  todayIsoDate: string;
}): DateValidationResult {
  const { startDate, endDate, todayIsoDate } = input;

  if (!startDate && !endDate) {
    return { success: true };
  }

  if (!startDate && endDate) {
    return { success: false, errorCode: "START_DATE_REQUIRED" };
  }

  if (startDate && startDate < todayIsoDate) {
    return { success: false, errorCode: "INVALID_START_DATE" };
  }

  if (startDate && endDate && endDate < startDate) {
    return { success: false, errorCode: "INVALID_END_DATE" };
  }

  return { success: true };
}

export async function getFilmRequestsSummary(params: {
  exhibitorAccountId: string;
  filmId: string;
}) {
  const { exhibitorAccountId, filmId } = params;

  return db.query.requests.findMany({
    where: and(
      eq(requests.exhibitorAccountId, exhibitorAccountId),
      eq(requests.filmId, filmId),
      inArray(requests.status, ["pending", "approved"])
    ),
    with: {
      cinema: {
        columns: { id: true, name: true },
      },
      room: {
        columns: { id: true, name: true },
      },
    },
    orderBy: [desc(requests.createdAt)],
    limit: 10,
  });
}

/**
 * Fetches the film price for a specific cinema's country.
 * Returns the filmPrice record if found, otherwise null.
 * Searches across all filmPrice entries for this film where the country is in the countries array.
 */
export async function getFilmPriceForCountry(filmId: string, country: string) {
  const prices = await db.query.filmPrices.findMany({
    where: eq(filmPrices.filmId, filmId),
  });

  // Find the first price entry where the country is included in the countries array
  const matchedPrice = prices.find((p) => p.countries.includes(country));
  return matchedPrice || null;
}

export type CartItemWithPrice = Awaited<ReturnType<typeof listCartItemsForAccount>>[number];

export async function listCartItemsForAccount(exhibitorAccountId: string) {
  const items = await db.query.cartItems.findMany({
    where: eq(cartItems.exhibitorAccountId, exhibitorAccountId),
    with: {
      film: {
        columns: { id: true, title: true, accountId: true, posterUrl: true },
      },
      cinema: {
        columns: { id: true, name: true, country: true },
      },
      room: {
        columns: { id: true, name: true },
      },
    },
    orderBy: [desc(cartItems.createdAt)],
  });

  // Fetch prices for each cart item based on cinema's country
  const itemsWithPrices = await Promise.all(
    items.map(async (item) => {
      const filmPrice = await getFilmPriceForCountry(item.filmId, item.cinema.country);
      return {
        ...item,
        price: filmPrice
          ? {
              price: filmPrice.price,
              currency: filmPrice.currency,
            }
          : null,
      };
    })
  );

  return itemsWithPrices;
}

export async function removeCartItemForAccount(params: {
  exhibitorAccountId: string;
  cartItemId: string;
}) {
  const { exhibitorAccountId, cartItemId } = params;

  const result = await db
    .delete(cartItems)
    .where(and(eq(cartItems.id, cartItemId), eq(cartItems.exhibitorAccountId, exhibitorAccountId)))
    .returning({ id: cartItems.id });

  return result[0] ?? null;
}

export async function listRequestsForAccount(params: {
  exhibitorAccountId: string;
  status?: RequestStatus;
  page: number;
  limit: number;
}) {
  const { exhibitorAccountId, status, page, limit } = params;

  const offset = (page - 1) * limit;
  const whereClause = status
    ? and(eq(requests.exhibitorAccountId, exhibitorAccountId), eq(requests.status, status))
    : eq(requests.exhibitorAccountId, exhibitorAccountId);

  const [rows, totals] = await Promise.all([
    db.query.requests.findMany({
      where: whereClause,
      with: {
        film: { columns: { id: true, title: true, posterUrl: true } },
        rightsHolderAccount: { columns: { id: true, companyName: true } },
        cinema: { columns: { id: true, name: true } },
        room: { columns: { id: true, name: true } },
        createdByUser: { columns: { id: true, name: true } },
      },
      orderBy: [desc(requests.createdAt)],
      limit,
      offset,
    }),
    db
      .select({ total: sql<number>`count(*)` })
      .from(requests)
      .where(whereClause),
  ]);

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: Number(totals[0]?.total ?? 0),
    },
  };
}

export async function cancelRequestForAccount(params: {
  exhibitorAccountId: string;
  requestId: string;
}) {
  const { exhibitorAccountId, requestId } = params;

  const result = await db
    .update(requests)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(requests.id, requestId),
        eq(requests.exhibitorAccountId, exhibitorAccountId),
        eq(requests.status, "pending")
      )
    )
    .returning({ id: requests.id, status: requests.status });

  return result[0] ?? null;
}

export async function relaunchRequestForAccount(params: {
  exhibitorAccountId: string;
  requestId: string;
  userId?: string;
}) {
  const { exhibitorAccountId, requestId, userId } = params;

  const current = await db.query.requests.findFirst({
    where: and(eq(requests.id, requestId), eq(requests.exhibitorAccountId, exhibitorAccountId)),
  });

  if (!current || (current.status !== "cancelled" && current.status !== "rejected")) {
    return null;
  }

  const inserted = await db
    .insert(requests)
    .values({
      exhibitorAccountId: current.exhibitorAccountId,
      rightsHolderAccountId: current.rightsHolderAccountId,
      createdByUserId: userId ?? current.createdByUserId,
      filmId: current.filmId,
      cinemaId: current.cinemaId,
      roomId: current.roomId,
      screeningCount: current.screeningCount,
      startDate: current.startDate,
      endDate: current.endDate,
      note: current.note,
      catalogPrice: current.catalogPrice,
      currency: current.currency,
      platformMarginRate: current.platformMarginRate,
      deliveryFees: current.deliveryFees,
      commissionRate: current.commissionRate,
      displayedPrice: current.displayedPrice,
      rightsHolderAmount: current.rightsHolderAmount,
      timelessAmount: current.timelessAmount,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: requests.id, status: requests.status });

  return inserted[0] ?? null;
}

export async function listOrdersForAccount(params: {
  exhibitorAccountId: string;
  page: number;
  limit: number;
}) {
  const { exhibitorAccountId, page, limit } = params;
  const offset = (page - 1) * limit;

  const [rows, totals] = await Promise.all([
    db.query.orders.findMany({
      where: eq(orders.exhibitorAccountId, exhibitorAccountId),
      with: {
        items: {
          with: {
            film: { columns: { id: true, title: true } },
            cinema: { columns: { id: true, name: true } },
          },
          orderBy: [desc(orderItems.createdAt)],
        },
      },
      orderBy: [desc(orders.createdAt)],
      limit,
      offset,
    }),
    db
      .select({ total: sql<number>`count(*)` })
      .from(orders)
      .where(eq(orders.exhibitorAccountId, exhibitorAccountId)),
  ]);

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: Number(totals[0]?.total ?? 0),
    },
  };
}
