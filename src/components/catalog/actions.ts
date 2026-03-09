"use server";

import { and, eq, or } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getActiveAccountCookie } from "@/lib/auth/membership";
import { db } from "@/lib/db";
import { cartItems, cinemas, films, requests, rooms } from "@/lib/db/schema";
import { calculatePricing, getPlatformPricingSettings, resolveCommissionRate } from "@/lib/pricing";

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
});

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
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

  const { filmId, cinemaId, roomId, screeningCount } = parsed.data;
  const startDate = parsed.data.startDate ?? getTodayIsoDate();
  const endDate = parsed.data.endDate ?? startDate;

  if (endDate < startDate) {
    return { error: "INVALID_INPUT" as const };
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

  // 4. Check for duplicates (same film + cinema + room + dates)
  const existingCartItem = await db.query.cartItems.findFirst({
    where: and(
      eq(cartItems.exhibitorAccountId, activeAccountId),
      eq(cartItems.filmId, filmId),
      eq(cartItems.cinemaId, cinemaId),
      eq(cartItems.roomId, roomId),
      eq(cartItems.startDate, startDate),
      eq(cartItems.endDate, endDate)
    ),
  });

  if (existingCartItem) {
    return { error: "ALREADY_IN_CART" as const };
  }

  // Also check if a similar request exists (pending or validated)
  const existingRequest = await db.query.requests.findFirst({
    where: and(
      eq(requests.exhibitorAccountId, activeAccountId),
      eq(requests.filmId, filmId),
      eq(requests.cinemaId, cinemaId),
      eq(requests.roomId, roomId),
      eq(requests.startDate, startDate),
      eq(requests.endDate, endDate),
      or(eq(requests.status, "pending"), eq(requests.status, "validated"))
    ),
  });

  if (existingRequest) {
    return { error: "ALREADY_REQUESTED" as const };
  }

  // 5. Insert cart item
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
  const activeAccountId = activeAccount.accountId;

  // 2. Validation
  const parsed = createRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "INVALID_INPUT" as const };
  }

  const { filmId, cinemaId, roomId, screeningCount } = parsed.data;
  const startDate = parsed.data.startDate ?? getTodayIsoDate();
  const endDate = parsed.data.endDate ?? startDate;

  if (endDate < startDate) {
    return { error: "INVALID_INPUT" as const };
  }

  // 3. Verify film exists and is available (direct or validation)
  const film = await db.query.films.findFirst({
    where: eq(films.id, filmId),
    with: {
      prices: true,
      account: true, // Rights holder
    },
  });

  if (!film || !film.account || film.status !== "active") {
    return { error: "FILM_NOT_FOUND" as const };
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

  // 4. Check for duplicates
  const existingRequest = await db.query.requests.findFirst({
    where: and(
      eq(requests.exhibitorAccountId, activeAccountId),
      eq(requests.filmId, filmId),
      eq(requests.cinemaId, cinemaId),
      eq(requests.roomId, roomId),
      eq(requests.startDate, startDate),
      eq(requests.endDate, endDate),
      or(eq(requests.status, "pending"), eq(requests.status, "validated"))
    ),
  });

  if (existingRequest) {
    return { error: "ALREADY_REQUESTED" as const };
  }

  // Also check cart (if type is "direct")
  if (film.type === "direct") {
    const existingCartItem = await db.query.cartItems.findFirst({
      where: and(
        eq(cartItems.exhibitorAccountId, activeAccountId),
        eq(cartItems.filmId, filmId),
        eq(cartItems.cinemaId, cinemaId),
        eq(cartItems.roomId, roomId),
        eq(cartItems.startDate, startDate),
        eq(cartItems.endDate, endDate)
      ),
    });

    if (existingCartItem) {
      return { error: "ALREADY_IN_CART" as const };
    }
  }

  // 5. Get pricing settings, compute totals, and insert request
  try {
    const settings = await getPlatformPricingSettings();
    const commissionRate = resolveCommissionRate(
      film.account.commissionRate,
      settings.defaultCommissionRate
    );

    const pricing = calculatePricing({
      catalogPrice: film.prices[0]?.price ?? 0,
      currency: film.prices[0]?.currency ?? "EUR",
      platformMarginRate: settings.platformMarginRate,
      deliveryFees: settings.deliveryFees,
      commissionRate,
    });

    // Calculate expiration date (30 days or X days before start date)
    const expiresAt = calculateExpirationDate(
      startDate,
      settings.requestExpirationDays,
      settings.requestUrgencyDaysBeforeStart
    );

    await db.insert(requests).values({
      exhibitorAccountId: activeAccountId,
      rightsHolderAccountId: film.accountId,
      filmId,
      cinemaId,
      roomId,
      screeningCount,
      startDate,
      endDate,
      catalogPrice: pricing.catalogPrice,
      currency: pricing.currency,
      platformMarginRate: pricing.platformMarginRate.toString(),
      deliveryFees: pricing.deliveryFees,
      commissionRate: pricing.commissionRate.toString(),
      displayedPrice: pricing.displayedPrice,
      rightsHolderAmount: pricing.rightsHolderAmount,
      timelessAmount: pricing.timelessAmount,
      expiresAt,
    });

    return { success: true as const };
  } catch (error) {
    console.error("Failed to create request:", error);
    return { error: "DATABASE_ERROR" as const };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateExpirationDate(
  startDate: string,
  expirationDays: number,
  urgencyDaysBeforeStart: number
): Date {
  const start = new Date(startDate);
  const today = new Date();

  // Calculate date X days before start
  const urgencyDate = new Date(start);
  urgencyDate.setDate(urgencyDate.getDate() - urgencyDaysBeforeStart);

  // Calculate date Y days from today
  const standardExpiration = new Date(today);
  standardExpiration.setDate(standardExpiration.getDate() + expirationDays);

  // Return the earliest of the two
  return urgencyDate < standardExpiration ? urgencyDate : standardExpiration;
}
