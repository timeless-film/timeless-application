import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { cartItems, films, accounts, cinemas, rooms } from "@/lib/db/schema";
import { calculatePricing } from "@/lib/pricing";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CartError =
  | "CART_ITEM_NOT_FOUND"
  | "UNAUTHORIZED"
  | "FILM_NOT_AVAILABLE"
  | "INVALID_FILM_TYPE"
  | "TERRITORY_NOT_AVAILABLE"
  | "INVALID_CINEMA"
  | "INVALID_ROOM"
  | "INVALID_DATE_RANGE";

export type CartResult = { success: true } | { success: false; error: CartError };

export interface AddToCartInput {
  exhibitorAccountId: string;
  filmId: string;
  cinemaId: string;
  roomId: string;
  screeningCount: number;
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
}

export interface CartItemWithDetails {
  id: string;
  filmId: string;
  filmTitle: string;
  filmYear: number | null;
  cinemaId: string;
  cinemaName: string;
  roomId: string;
  roomName: string;
  screeningCount: number;
  startDate: string | null;
  endDate: string | null;
  catalogPrice: number; // cents
  currency: string;
  displayedPrice: number; // cents
  createdAt: Date;
}

export interface CartSummary {
  items: CartItemWithDetails[];
  subtotalsByCurrency: Record<string, number>; // currency -> total in cents
  totalItems: number;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Validate date range according to E06 rules:
 * - startDate alone is OK
 * - endDate requires startDate
 * - If both: startDate >= J+1 in UTC, endDate >= startDate
 */
export function validateDateRange(params: { startDate?: string; endDate?: string }): {
  valid: boolean;
  error?: CartError;
} {
  const { startDate, endDate } = params;

  // endDate without startDate is invalid
  if (endDate && !startDate) {
    return { valid: false, error: "INVALID_DATE_RANGE" };
  }

  // If both dates provided, validate J+1 and ordering
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const tomorrow = new Date();
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // startDate must be at least tomorrow (J+1)
    if (start < tomorrow) {
      return { valid: false, error: "INVALID_DATE_RANGE" };
    }

    // endDate >= startDate
    if (end < start) {
      return { valid: false, error: "INVALID_DATE_RANGE" };
    }
  }

  // startDate alone needs J+1 check
  if (startDate && !endDate) {
    const start = new Date(startDate);
    const tomorrow = new Date();
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    if (start < tomorrow) {
      return { valid: false, error: "INVALID_DATE_RANGE" };
    }
  }

  return { valid: true };
}

// ─── Cart operations ──────────────────────────────────────────────────────────

/**
 * Add an item to cart with full validation.
 */
export async function addToCart(input: AddToCartInput): Promise<CartResult> {
  const { exhibitorAccountId, filmId, cinemaId, roomId, screeningCount, startDate, endDate } =
    input;

  // Validate date range
  const dateValidation = validateDateRange({ startDate, endDate });
  if (!dateValidation.valid) {
    return { success: false, error: dateValidation.error! };
  }

  // Fetch film with pricing and territory availability
  const film = await db.query.films.findFirst({
    where: eq(films.id, filmId),
    with: {
      prices: true,
      account: true,
    },
  });

  if (!film) {
    return { success: false, error: "FILM_NOT_AVAILABLE" };
  }

  // Only "direct" films can be added to cart
  if (film.type !== "direct") {
    return { success: false, error: "INVALID_FILM_TYPE" };
  }

  // Fetch exhibitor account to check territory
  const exhibitorAccount = await db.query.accounts.findFirst({
    where: eq(accounts.id, exhibitorAccountId),
  });

  if (!exhibitorAccount || !exhibitorAccount.country) {
    return { success: false, error: "TERRITORY_NOT_AVAILABLE" };
  }

  // Check if film is available in exhibitor's territory
  const filmPrice = film.prices.find((p) => p.countries.includes(exhibitorAccount.country!));
  if (!filmPrice) {
    return { success: false, error: "TERRITORY_NOT_AVAILABLE" };
  }

  // Validate cinema belongs to exhibitor
  const cinema = await db.query.cinemas.findFirst({
    where: and(eq(cinemas.id, cinemaId), eq(cinemas.accountId, exhibitorAccountId)),
  });

  if (!cinema) {
    return { success: false, error: "INVALID_CINEMA" };
  }

  // Validate room belongs to cinema
  const room = await db.query.rooms.findFirst({
    where: and(eq(rooms.id, roomId), eq(rooms.cinemaId, cinemaId)),
  });

  if (!room) {
    return { success: false, error: "INVALID_ROOM" };
  }

  // E06 decision: no duplicate blocking, users can add same film multiple times
  // Just insert the cart item
  await db.insert(cartItems).values({
    exhibitorAccountId,
    filmId,
    cinemaId,
    roomId,
    screeningCount,
    startDate: startDate || null,
    endDate: endDate || null,
  });

  return { success: true };
}

/**
 * Remove an item from cart.
 */
export async function removeFromCart(params: {
  cartItemId: string;
  exhibitorAccountId: string;
}): Promise<CartResult> {
  const { cartItemId, exhibitorAccountId } = params;

  const item = await db.query.cartItems.findFirst({
    where: eq(cartItems.id, cartItemId),
  });

  if (!item) {
    return { success: false, error: "CART_ITEM_NOT_FOUND" };
  }

  if (item.exhibitorAccountId !== exhibitorAccountId) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  await db.delete(cartItems).where(eq(cartItems.id, cartItemId));

  return { success: true };
}

/**
 * Get cart summary with items and subtotals by currency.
 */
export async function getCartSummary(params: { exhibitorAccountId: string }): Promise<CartSummary> {
  const items = await db.query.cartItems.findMany({
    where: eq(cartItems.exhibitorAccountId, params.exhibitorAccountId),
    with: {
      film: {
        with: {
          prices: true,
          account: true,
        },
      },
      cinema: true,
      room: true,
    },
    orderBy: (cartItems, { desc }) => [desc(cartItems.createdAt)],
  });

  // Get exhibitor territory
  const exhibitorAccount = await db.query.accounts.findFirst({
    where: eq(accounts.id, params.exhibitorAccountId),
  });

  const territory = exhibitorAccount?.country || "FR";

  const itemsWithDetails: CartItemWithDetails[] = [];
  const subtotalsByCurrency: Record<string, number> = {};

  for (const item of items) {
    const filmPrice = item.film.prices.find((p) => p.countries.includes(territory));
    if (!filmPrice) continue; // Skip items without price for territory

    try {
      // Get platform settings for margin and delivery fees
      const settings = await db.query.platformSettings.findFirst();

      const platformMarginRate = settings?.platformMarginRate
        ? parseFloat(settings.platformMarginRate)
        : 0.2;
      const deliveryFees = settings?.deliveryFees || 5000; // Default 50 EUR
      const commissionRate = item.film.account.commissionRate
        ? parseFloat(item.film.account.commissionRate)
        : settings?.defaultCommissionRate
          ? parseFloat(settings.defaultCommissionRate)
          : 0.1;

      const pricing = calculatePricing({
        catalogPrice: filmPrice.price,
        currency: filmPrice.currency,
        platformMarginRate,
        deliveryFees,
        commissionRate,
      });

      itemsWithDetails.push({
        id: item.id,
        filmId: item.filmId,
        filmTitle: item.film.title,
        filmYear: item.film.releaseYear,
        cinemaId: item.cinemaId,
        cinemaName: item.cinema.name,
        roomId: item.roomId,
        roomName: item.room.name,
        screeningCount: item.screeningCount,
        startDate: item.startDate,
        endDate: item.endDate,
        catalogPrice: filmPrice.price,
        currency: filmPrice.currency,
        displayedPrice: pricing.displayedPrice,
        createdAt: item.createdAt,
      });

      // Accumulate subtotals by currency
      const currency = filmPrice.currency;
      subtotalsByCurrency[currency] = (subtotalsByCurrency[currency] || 0) + pricing.displayedPrice;
    } catch (error) {
      console.error("Error calculating pricing for cart item:", item.id, error);
      // Skip items with pricing errors
    }
  }

  return {
    items: itemsWithDetails,
    subtotalsByCurrency,
    totalItems: itemsWithDetails.length,
  };
}

/**
 * Clear entire cart for an exhibitor.
 */
export async function clearCart(params: { exhibitorAccountId: string }): Promise<CartResult> {
  await db.delete(cartItems).where(eq(cartItems.exhibitorAccountId, params.exhibitorAccountId));

  return { success: true };
}

/**
 * Get cart item count for badge display.
 */
export async function getCartItemCount(params: { exhibitorAccountId: string }): Promise<number> {
  const result = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(cartItems)
    .where(eq(cartItems.exhibitorAccountId, params.exhibitorAccountId));

  return result[0]?.count ?? 0;
}
