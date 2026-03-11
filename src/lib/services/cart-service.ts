import { and, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { cartItems, films, accounts, cinemas, rooms } from "@/lib/db/schema";
import { calculatePricing, getPlatformPricingSettings, resolveCommissionRate } from "@/lib/pricing";
import { convertCurrency } from "@/lib/services/exchange-rate-service";

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
  filmPosterUrl: string | null;
  cinemaId: string;
  cinemaName: string;
  roomId: string;
  roomName: string;
  screeningCount: number;
  startDate: string | null;
  endDate: string | null;
  catalogPrice: number; // cents — in exhibitor's currency (converted if needed)
  currency: string; // exhibitor's preferred currency
  displayedPrice: number; // cents — in exhibitor's currency
  originalCatalogPrice: number | null; // cents in film's native currency (null if same currency)
  originalCurrency: string | null; // film's native currency (null if same currency)
  exchangeRate: string | null; // decimal string rate applied (null if same currency)
  createdAt: Date;
}

export interface UnavailableCartItem {
  id: string;
  filmId: string;
  filmTitle: string;
  filmPosterUrl: string | null;
  cinemaName: string;
  roomName: string;
  reason: "no_territory_price" | "conversion_failed" | "pricing_error";
}

export interface CartSummary {
  items: CartItemWithDetails[];
  unavailableItems: UnavailableCartItem[];
  subtotal: number; // cents — sum of displayedPrice × screeningCount (excl. delivery)
  deliveryFeesPerItem: number; // cents — delivery fee per film
  deliveryFeesTotal: number; // cents — deliveryFeesPerItem × numberOfFilms
  total: number; // cents — subtotal + deliveryFeesTotal
  currency: string; // exhibitor's preferred currency
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

  // Fetch exhibitor account to check cinema is theirs
  const exhibitorAccount = await db.query.accounts.findFirst({
    where: eq(accounts.id, exhibitorAccountId),
  });

  if (!exhibitorAccount) {
    return { success: false, error: "TERRITORY_NOT_AVAILABLE" };
  }

  // Validate cinema belongs to exhibitor
  const cinema = await db.query.cinemas.findFirst({
    where: and(eq(cinemas.id, cinemaId), eq(cinemas.accountId, exhibitorAccountId)),
  });

  if (!cinema) {
    return { success: false, error: "INVALID_CINEMA" };
  }

  // Check if film is available in cinema's territory (screening location)
  const filmPrice = film.prices.find((p) => p.countries.includes(cinema.country));
  if (!filmPrice) {
    return { success: false, error: "TERRITORY_NOT_AVAILABLE" };
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
 * Get cart summary with items converted to exhibitor's preferred currency.
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

  // Get exhibitor account for territory and preferred currency
  const exhibitorAccount = await db.query.accounts.findFirst({
    where: eq(accounts.id, params.exhibitorAccountId),
  });

  const preferredCurrency = exhibitorAccount?.preferredCurrency || "EUR";

  // Get platform pricing settings once
  const settings = await getPlatformPricingSettings();

  const itemsWithDetails: CartItemWithDetails[] = [];
  const unavailableItems: UnavailableCartItem[] = [];
  let subtotal = 0;

  for (const item of items) {
    // Use cinema's country (screening territory), not exhibitor's HQ country
    const itemTerritory = item.cinema.country;
    const filmPrice = item.film.prices.find((p) => p.countries.includes(itemTerritory));
    if (!filmPrice) {
      unavailableItems.push({
        id: item.id,
        filmId: item.filmId,
        filmTitle: item.film.title,
        filmPosterUrl: item.film.posterUrl ?? null,
        cinemaName: item.cinema.name,
        roomName: item.room.name,
        reason: "no_territory_price",
      });
      continue;
    }

    try {
      const commissionRate = resolveCommissionRate(
        item.film.account.commissionRate,
        settings.defaultCommissionRate
      );

      const filmCurrency = filmPrice.currency;
      const needsConversion = filmCurrency !== preferredCurrency;

      let catalogPriceInExhibitorCurrency = filmPrice.price;
      let exchangeRate: string | null = null;

      if (needsConversion) {
        const converted = await convertCurrency(filmPrice.price, filmCurrency, preferredCurrency);
        if (converted === null) {
          // Conversion failed — mark item as unavailable
          console.error(
            `Currency conversion failed for cart item ${item.id}: ${filmCurrency} → ${preferredCurrency}`
          );
          unavailableItems.push({
            id: item.id,
            filmId: item.filmId,
            filmTitle: item.film.title,
            filmPosterUrl: item.film.posterUrl ?? null,
            cinemaName: item.cinema.name,
            roomName: item.room.name,
            reason: "conversion_failed",
          });
          continue;
        }
        catalogPriceInExhibitorCurrency = converted;
        // Calculate the effective exchange rate for snapshot
        exchangeRate = (converted / filmPrice.price).toFixed(6);
      }

      const pricing = calculatePricing({
        catalogPrice: catalogPriceInExhibitorCurrency,
        currency: preferredCurrency,
        platformMarginRate: settings.platformMarginRate,
        deliveryFees: settings.deliveryFees,
        commissionRate,
      });

      itemsWithDetails.push({
        id: item.id,
        filmId: item.filmId,
        filmTitle: item.film.title,
        filmYear: item.film.releaseYear,
        filmPosterUrl: item.film.posterUrl ?? null,
        cinemaId: item.cinemaId,
        cinemaName: item.cinema.name,
        roomId: item.roomId,
        roomName: item.room.name,
        screeningCount: item.screeningCount,
        startDate: item.startDate,
        endDate: item.endDate,
        catalogPrice: catalogPriceInExhibitorCurrency,
        currency: preferredCurrency,
        displayedPrice: pricing.displayedPrice,
        originalCatalogPrice: needsConversion ? filmPrice.price : null,
        originalCurrency: needsConversion ? filmCurrency : null,
        exchangeRate,
        createdAt: item.createdAt,
      });

      subtotal += pricing.displayedPrice * item.screeningCount;
    } catch (error) {
      console.error("Error calculating pricing for cart item:", item.id, error);
      unavailableItems.push({
        id: item.id,
        filmId: item.filmId,
        filmTitle: item.film.title,
        filmPosterUrl: item.film.posterUrl ?? null,
        cinemaName: item.cinema.name,
        roomName: item.room.name,
        reason: "pricing_error",
      });
    }
  }

  const deliveryFeesPerItem = settings.deliveryFees;
  const deliveryFeesTotal = deliveryFeesPerItem * itemsWithDetails.length;
  const total = subtotal + deliveryFeesTotal;

  return {
    items: itemsWithDetails,
    unavailableItems,
    subtotal,
    deliveryFeesPerItem,
    deliveryFeesTotal,
    total,
    currency: preferredCurrency,
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
