import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { cartItems, films, orders, orderItems, requests, filmPrices } from "@/lib/db/schema";
import {
  sendRequestApprovedToExhibitor,
  sendRequestNotificationToRightsHolder,
  sendRequestRejectedToExhibitor,
} from "@/lib/email/request-emails";
import { getAccountUserEmails } from "@/lib/services/account-users";
import { generateValidationToken } from "@/lib/services/request-token-service";

export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled" | "paid";

export interface DateValidationResult {
  success: boolean;
  errorCode?: "START_DATE_REQUIRED" | "INVALID_START_DATE" | "INVALID_END_DATE";
}

// ─── Incoming requests for rights holders ─────────────────────────────────────

export async function listIncomingRequestsForRightsHolder(params: {
  rightsHolderAccountId: string;
  status?: RequestStatus;
  filmId?: string;
  page: number;
  limit: number;
}) {
  const { rightsHolderAccountId, status, filmId, page, limit } = params;
  const offset = (page - 1) * limit;

  const conditions = [eq(requests.rightsHolderAccountId, rightsHolderAccountId)];

  if (status) {
    conditions.push(eq(requests.status, status));
  } else {
    conditions.push(eq(requests.status, "pending"));
  }

  if (filmId) {
    conditions.push(eq(requests.filmId, filmId));
  }

  const whereClause = and(...conditions);

  const [rows, totals] = await Promise.all([
    db.query.requests.findMany({
      where: whereClause,
      with: {
        film: { columns: { id: true, title: true, posterUrl: true } },
        exhibitorAccount: {
          columns: { id: true, companyName: true, country: true, vatNumber: true },
        },
        cinema: { columns: { id: true, name: true, city: true, country: true } },
        room: { columns: { id: true, name: true, capacity: true } },
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
  statuses?: RequestStatus[];
  search?: string;
  page: number;
  limit: number;
}) {
  const { exhibitorAccountId, status, statuses, search, page, limit } = params;

  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [eq(requests.exhibitorAccountId, exhibitorAccountId)];

  if (statuses && statuses.length > 0) {
    conditions.push(inArray(requests.status, statuses));
  } else if (status) {
    conditions.push(eq(requests.status, status));
  }

  // Search by film title requires a join
  if (search?.trim()) {
    const searchPattern = `%${search.trim()}%`;
    // Get matching request IDs via join
    const matchingIds = await db
      .select({ id: requests.id })
      .from(requests)
      .innerJoin(films, eq(requests.filmId, films.id))
      .where(and(...conditions, ilike(films.title, searchPattern)));

    if (matchingIds.length === 0) {
      return { data: [], pagination: { page, limit, total: 0 } };
    }

    const ids = matchingIds.map((r) => r.id);
    conditions.push(inArray(requests.id, ids));
  }

  const whereClause = and(...conditions);

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

  const newRequest = inserted[0] ?? null;

  // Send validation emails to RH users (fire-and-forget)
  if (newRequest) {
    sendRelaunchValidationEmails({
      requestId: newRequest.id,
      current,
    }).catch((err) => {
      console.error("Failed to send relaunch validation emails:", err);
    });
  }

  return newRequest;
}

/**
 * Fetch cinema/room/film/exhibitor details and send notification emails to all RH users for a relaunched request.
 */
async function sendRelaunchValidationEmails(params: {
  requestId: string;
  current: {
    rightsHolderAccountId: string;
    exhibitorAccountId: string;
    filmId: string;
    cinemaId: string;
    roomId: string;
    screeningCount: number;
    startDate: string | null;
    endDate: string | null;
    displayedPrice: number;
    rightsHolderAmount: number;
    currency: string;
    note: string | null;
  };
}) {
  const { requestId, current } = params;

  const [filmData, cinemaData, roomData, exhibitorAccount] = await Promise.all([
    db.query.films.findFirst({
      where: (films, { eq: eqOp }) => eqOp(films.id, current.filmId),
      columns: { title: true },
    }),
    db.query.cinemas.findFirst({
      where: (cinemas, { eq: eqOp }) => eqOp(cinemas.id, current.cinemaId),
      columns: { name: true, address: true, city: true, postalCode: true, country: true },
    }),
    db.query.rooms.findFirst({
      where: (rooms, { eq: eqOp }) => eqOp(rooms.id, current.roomId),
      columns: { name: true, capacity: true },
    }),
    db.query.accounts.findFirst({
      where: (accounts, { eq: eqOp }) => eqOp(accounts.id, current.exhibitorAccountId),
      columns: { companyName: true, country: true, vatNumber: true },
    }),
  ]);

  if (!filmData || !cinemaData || !roomData || !exhibitorAccount) return;

  const rhUsers = await getAccountUserEmails(current.rightsHolderAccountId);
  if (rhUsers.length === 0) return;

  for (const user of rhUsers) {
    const token = await generateValidationToken(requestId, user.userId);

    await db
      .update(requests)
      .set({ validationToken: token, updatedAt: new Date() })
      .where(eq(requests.id, requestId));

    await sendRequestNotificationToRightsHolder({
      requestId,
      token,
      filmTitle: filmData.title,
      exhibitorCompanyName: exhibitorAccount.companyName,
      exhibitorCountry: exhibitorAccount.country,
      exhibitorVatNumber: exhibitorAccount.vatNumber,
      cinemaName: cinemaData.name,
      cinemaAddress: cinemaData.address,
      cinemaCity: cinemaData.city,
      cinemaPostalCode: cinemaData.postalCode,
      cinemaCountry: cinemaData.country,
      roomName: roomData.name,
      roomCapacity: roomData.capacity,
      screeningCount: current.screeningCount,
      startDate: current.startDate,
      endDate: current.endDate,
      displayedPrice: current.displayedPrice,
      rightsHolderAmount: current.rightsHolderAmount,
      currency: current.currency,
      note: current.note,
      recipientEmail: user.email,
      recipientName: user.name,
      recipientLocale: user.preferredLocale,
    });
  }
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

// ─── Shared exhibitor notification ────────────────────────────────────────────

export async function sendExhibitorRequestNotification(params: {
  requestId: string;
  action: "approve" | "reject";
  note?: string;
}) {
  const request = await db.query.requests.findFirst({
    where: eq(requests.id, params.requestId),
    with: {
      film: { columns: { title: true } },
      exhibitorAccount: { columns: { companyName: true } },
      cinema: { columns: { name: true } },
      room: { columns: { name: true } },
    },
  });

  if (!request) return;

  const exhibitorUsers = await getAccountUserEmails(request.exhibitorAccountId);

  for (const user of exhibitorUsers) {
    const locale = user.preferredLocale === "fr" ? "fr" : "en";

    if (params.action === "approve") {
      await sendRequestApprovedToExhibitor({
        recipientEmail: user.email,
        recipientName: user.name,
        recipientLocale: locale,
        filmTitle: request.film.title,
        exhibitorCompanyName: request.exhibitorAccount.companyName ?? "",
        cinemaName: request.cinema.name,
        roomName: request.room.name,
        screeningCount: request.screeningCount,
        startDate: request.startDate,
        endDate: request.endDate,
        displayedPrice: request.displayedPrice,
        currency: request.currency,
        note: request.note,
        approvalNote: params.note ?? null,
      });
    } else {
      await sendRequestRejectedToExhibitor({
        recipientEmail: user.email,
        recipientName: user.name,
        recipientLocale: locale,
        filmTitle: request.film.title,
        exhibitorCompanyName: request.exhibitorAccount.companyName ?? "",
        cinemaName: request.cinema.name,
        roomName: request.room.name,
        screeningCount: request.screeningCount,
        startDate: request.startDate,
        endDate: request.endDate,
        displayedPrice: request.displayedPrice,
        currency: request.currency,
        note: request.note,
        rejectionReason: params.note ?? null,
      });
    }
  }
}
