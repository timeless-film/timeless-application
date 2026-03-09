import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { cartItems, accounts, cinemas, rooms } from "@/lib/db/schema";
import { calculatePricing, getPlatformPricingSettings, resolveCommissionRate } from "@/lib/pricing";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckoutError =
  | "CART_EMPTY"
  | "UNAUTHORIZED"
  | "FILM_NOT_FOUND"
  | "FILM_NOT_AVAILABLE"
  | "TERRITORY_NOT_AVAILABLE"
  | "CINEMA_NOT_FOUND"
  | "ROOM_NOT_FOUND"
  | "PRICE_CHANGED"
  | "INVALID_OWNERSHIP";

export interface CheckoutValidationResult {
  success: boolean;
  error?: CheckoutError;
  errorDetails?: {
    itemId?: string;
    filmTitle?: string;
    message?: string;
  };
  validatedItems?: ValidatedCartItem[];
}

export interface ValidatedCartItem {
  id: string;
  filmId: string;
  filmTitle: string;
  cinemaId: string;
  cinemaName: string;
  roomId: string;
  roomName: string;
  rightsHolderAccountId: string;
  screeningCount: number;
  startDate: string | null;
  endDate: string | null;
  catalogPrice: number; // cents
  currency: string;
  platformMarginRate: number;
  deliveryFees: number;
  commissionRate: number;
  displayedPrice: number;
  rightsHolderAmount: number;
  timelessAmount: number;
}

// ─── Validation logic ─────────────────────────────────────────────────────────

/**
 * Validates cart items for checkout:
 * 1. Check cart not empty
 * 2. For each item:
 *    - Verify film exists and is "direct" type
 *    - Verify film is available in exhibitor's territory
 *    - Verify cinema and room belong to exhibitor
 *    - Calculate current pricing
 * 3. Return validated items ready for order creation
 *
 * This function does NOT check for price staleness — that's handled
 * by the caller when comparing expected vs. current prices.
 */
export async function validateCheckout(params: {
  exhibitorAccountId: string;
}): Promise<CheckoutValidationResult> {
  const { exhibitorAccountId } = params;

  // Get exhibitor account
  const exhibitorAccount = await db.query.accounts.findFirst({
    where: eq(accounts.id, exhibitorAccountId),
  });

  if (!exhibitorAccount) {
    return {
      success: false,
      error: "UNAUTHORIZED",
    };
  }

  // Get all cart items
  const items = await db.query.cartItems.findMany({
    where: eq(cartItems.exhibitorAccountId, exhibitorAccountId),
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
  });

  if (items.length === 0) {
    return {
      success: false,
      error: "CART_EMPTY",
    };
  }

  // Get platform pricing settings once
  const settings = await getPlatformPricingSettings();

  const validatedItems: ValidatedCartItem[] = [];

  for (const item of items) {
    // Verify film exists
    if (!item.film) {
      return {
        success: false,
        error: "FILM_NOT_FOUND",
        errorDetails: {
          itemId: item.id,
          message: "Film not found",
        },
      };
    }

    // Verify film is "direct" type (only direct films can be in cart)
    if (item.film.type !== "direct") {
      return {
        success: false,
        error: "FILM_NOT_AVAILABLE",
        errorDetails: {
          itemId: item.id,
          filmTitle: item.film.title,
          message: `Film type is "${item.film.type}", expected "direct"`,
        },
      };
    }

    // Verify film is available in CINEMA'S TERRITORY (not exhibitor's)
    // This matches the logic in addToCart action
    const filmPrice = item.film.prices.find((p) => p.countries.includes(item.cinema.country));
    if (!filmPrice) {
      return {
        success: false,
        error: "TERRITORY_NOT_AVAILABLE",
        errorDetails: {
          itemId: item.id,
          filmTitle: item.film.title,
          message: `Film not available in territory ${item.cinema.country}`,
        },
      };
    }

    // Verify cinema belongs to exhibitor
    if (item.cinema.accountId !== exhibitorAccountId) {
      return {
        success: false,
        error: "INVALID_OWNERSHIP",
        errorDetails: {
          itemId: item.id,
          filmTitle: item.film.title,
          message: "Cinema does not belong to exhibitor",
        },
      };
    }

    // Verify cinema still exists
    const cinema = await db.query.cinemas.findFirst({
      where: and(eq(cinemas.id, item.cinemaId), eq(cinemas.accountId, exhibitorAccountId)),
    });

    if (!cinema) {
      return {
        success: false,
        error: "CINEMA_NOT_FOUND",
        errorDetails: {
          itemId: item.id,
          filmTitle: item.film.title,
        },
      };
    }

    // Verify room belongs to cinema
    const room = await db.query.rooms.findFirst({
      where: and(eq(rooms.id, item.roomId), eq(rooms.cinemaId, item.cinemaId)),
    });

    if (!room) {
      return {
        success: false,
        error: "ROOM_NOT_FOUND",
        errorDetails: {
          itemId: item.id,
          filmTitle: item.film.title,
        },
      };
    }

    // Calculate current pricing
    const commissionRate = resolveCommissionRate(
      item.film.account.commissionRate,
      settings.defaultCommissionRate
    );

    const pricing = calculatePricing({
      catalogPrice: filmPrice.price,
      currency: filmPrice.currency,
      platformMarginRate: settings.platformMarginRate,
      deliveryFees: settings.deliveryFees,
      commissionRate,
    });

    validatedItems.push({
      id: item.id,
      filmId: item.filmId,
      filmTitle: item.film.title,
      cinemaId: item.cinemaId,
      cinemaName: cinema.name,
      roomId: item.roomId,
      roomName: room.name,
      rightsHolderAccountId: item.film.accountId,
      screeningCount: item.screeningCount,
      startDate: item.startDate,
      endDate: item.endDate,
      catalogPrice: filmPrice.price,
      currency: filmPrice.currency,
      platformMarginRate: settings.platformMarginRate,
      deliveryFees: settings.deliveryFees,
      commissionRate,
      displayedPrice: pricing.displayedPrice,
      rightsHolderAmount: pricing.rightsHolderAmount,
      timelessAmount: pricing.timelessAmount,
    });
  }

  return {
    success: true,
    validatedItems,
  };
}

/**
 * Recalculates cart items with current pricing.
 * Used when user clicks "Recalculate" after a price change.
 *
 * This function does not modify the cart — it only returns
 * the updated pricing for UI display.
 */
export async function recalculateCartPricing(params: { exhibitorAccountId: string }): Promise<{
  success: boolean;
  items?: Array<{
    id: string;
    filmTitle: string;
    oldPrice?: number;
    newPrice: number;
    currency: string;
  }>;
  error?: CheckoutError;
  errorDetails?: {
    itemId?: string;
    filmTitle?: string;
    message?: string;
  };
}> {
  const validation = await validateCheckout(params);

  if (!validation.success) {
    return {
      success: false,
      error: validation.error,
      errorDetails: validation.errorDetails,
    };
  }

  const items = validation.validatedItems!.map((item) => ({
    id: item.id,
    filmTitle: item.filmTitle,
    newPrice: item.displayedPrice,
    currency: item.currency,
  }));

  return {
    success: true,
    items,
  };
}
