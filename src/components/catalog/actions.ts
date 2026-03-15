"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getActiveAccountCookie } from "@/lib/auth/membership";
import { db } from "@/lib/db";
import { cartItems, cinemas, films, rooms } from "@/lib/db/schema";
import { getFilmRequestsSummary } from "@/lib/services/booking-service";
import { trackFilmEvent } from "@/lib/services/film-event-service";
import { createRequest as createRequestService } from "@/lib/services/request-service";

// ─── Validation ───────────────────────────────────────────────────────────────

const optionalIsoDateSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? undefined : trimmedValue;
  },
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
);

const addToCartSchema = z.object({
  filmId: z.string().uuid(),
  cinemaId: z.string().uuid(),
  roomId: z.string().uuid(),
  screeningCount: z.number().int().min(1),
  startDate: optionalIsoDateSchema,
  endDate: optionalIsoDateSchema,
});

const createRequestSchema = z.object({
  filmId: z.string().uuid(),
  cinemaId: z.string().uuid(),
  roomId: z.string().uuid(),
  screeningCount: z.number().int().min(1),
  startDate: optionalIsoDateSchema,
  endDate: optionalIsoDateSchema,
  note: z.string().max(1000).optional(),
});

function getTomorrowIsoDateUtc(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// ─── Add to cart (type: "direct") ─────────────────────────────────────────────

export async function addToCart(input: z.infer<typeof addToCartSchema>) {
  // 1. Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { error: "UNAUTHORIZED" as const };
  }

  const activeAccount = await getActiveAccountCookie();
  if (!activeAccount?.accountId) {
    return { error: "NO_ACTIVE_ACCOUNT" as const };
  }
  const activeAccountId = activeAccount.accountId;

  // 2. Validation
  const parsed = addToCartSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "INVALID_INPUT" as const };
  }

  const { filmId, cinemaId, roomId, screeningCount, startDate, endDate } = parsed.data;
  const minStartDate = getTomorrowIsoDateUtc();

  if (endDate && !startDate) {
    return { error: "END_DATE_WITHOUT_START" as const, field: "startDate" as const };
  }

  if (startDate && startDate < minStartDate) {
    return { error: "START_DATE_IN_PAST" as const, field: "startDate" as const };
  }

  if (startDate && endDate && endDate < startDate) {
    return { error: "END_DATE_BEFORE_START" as const, field: "endDate" as const };
  }

  // 3. Verify film exists and is available for direct booking
  const film = await db.query.films.findFirst({
    where: eq(films.id, filmId),
    with: {
      prices: true,
      account: true,
    },
  });

  if (!film || film.status !== "active") {
    return { error: "FILM_NOT_FOUND" as const };
  }

  if (film.type !== "direct") {
    return { error: "FILM_NOT_DIRECT" as const };
  }

  // 3b. Verify cinema ownership + room ownership
  const cinema = await db.query.cinemas.findFirst({
    where: and(eq(cinemas.id, cinemaId), eq(cinemas.accountId, activeAccountId)),
  });
  if (!cinema) {
    return { error: "INVALID_INPUT" as const };
  }

  const room = await db.query.rooms.findFirst({
    where: and(eq(rooms.id, roomId), eq(rooms.cinemaId, cinemaId)),
  });
  if (!room) {
    return { error: "INVALID_INPUT" as const };
  }

  // 3c. Verify territory availability for selected cinema country
  const hasMatchingPrice = film.prices.some((priceZone) =>
    priceZone.countries.includes(cinema.country)
  );
  if (!hasMatchingPrice) {
    return { error: "FILM_NOT_FOUND" as const };
  }

  // 4. Insert cart item
  try {
    await db.insert(cartItems).values({
      exhibitorAccountId: activeAccountId,
      filmId,
      cinemaId,
      roomId,
      screeningCount,
      startDate,
      endDate,
    });

    // Track cart_add event (fire-and-forget)
    trackFilmEvent(filmId, activeAccountId, "cart_add");

    return { success: true as const };
  } catch (error) {
    console.error("Failed to add to cart:", error);
    return { error: "DATABASE_ERROR" as const };
  }
}

// ─── Create request (type: "validation") ──────────────────────────────────────

export async function createRequest(input: z.infer<typeof createRequestSchema>) {
  // 1. Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { error: "UNAUTHORIZED" as const };
  }

  const activeAccount = await getActiveAccountCookie();
  if (!activeAccount?.accountId) {
    return { error: "NO_ACTIVE_ACCOUNT" as const };
  }

  // 2. Validation
  const parsed = createRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "INVALID_INPUT" as const };
  }

  const { filmId, cinemaId, roomId, screeningCount, startDate, endDate, note } = parsed.data;
  const minStartDate = getTomorrowIsoDateUtc();

  if (endDate && !startDate) {
    return { error: "END_DATE_WITHOUT_START" as const, field: "startDate" as const };
  }

  if (startDate && startDate < minStartDate) {
    return { error: "START_DATE_IN_PAST" as const, field: "startDate" as const };
  }

  if (startDate && endDate && endDate < startDate) {
    return { error: "END_DATE_BEFORE_START" as const, field: "endDate" as const };
  }

  // 3. Delegate to service (handles validation, pricing, token generation, email)
  const result = await createRequestService({
    exhibitorAccountId: activeAccount.accountId,
    filmId,
    cinemaId,
    roomId,
    screeningCount,
    startDate,
    endDate,
    note,
    createdByUserId: session.user.id,
  });

  if (!result.success) {
    return { error: result.error as string };
  }

  return { success: true as const };
}

export async function getFilmRequestSummary(input: { filmId: string }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { error: "UNAUTHORIZED" as const };
  }

  const activeAccount = await getActiveAccountCookie();
  if (!activeAccount?.accountId) {
    return { error: "NO_ACTIVE_ACCOUNT" as const };
  }

  const filmIdResult = z.string().uuid().safeParse(input.filmId);
  if (!filmIdResult.success) {
    return { error: "INVALID_INPUT" as const };
  }

  const summary = await getFilmRequestsSummary({
    exhibitorAccountId: activeAccount.accountId,
    filmId: filmIdResult.data,
  });

  return { success: true as const, data: summary };
}
