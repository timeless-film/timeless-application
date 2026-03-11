import { eq, and } from "drizzle-orm";

import { db } from "@/lib/db";
import { cartItems, accounts, cinemas, rooms, requests } from "@/lib/db/schema";
import { calculatePricing, getPlatformPricingSettings, resolveCommissionRate } from "@/lib/pricing";
import { convertCurrency } from "@/lib/services/exchange-rate-service";
import { createStripeCheckoutSession, getOrUpdateStripeCustomer } from "@/lib/stripe";

import type Stripe from "stripe";

// ─── Constants ─────────────────────────────────────────────────────────────────

const DELIVERY_FEES_LABEL: Record<string, string> = {
  en: "Delivery fees",
  fr: "Frais de livraison",
};

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
  | "INVALID_OWNERSHIP"
  | "RIGHTS_HOLDER_NOT_ONBOARDED"
  | "ADDRESS_INCOMPLETE"
  | "STRIPE_ERROR"
  | "REQUEST_NOT_FOUND"
  | "REQUEST_NOT_APPROVED"
  | "REQUEST_EXPIRED";

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
  catalogPrice: number; // cents — in exhibitor's currency (converted if needed)
  currency: string; // exhibitor's preferred currency
  platformMarginRate: number;
  deliveryFees: number;
  commissionRate: number;
  displayedPrice: number;
  rightsHolderAmount: number;
  timelessAmount: number;
  originalCatalogPrice: number | null; // cents in film's native currency (null if same)
  originalCurrency: string | null; // film's native currency (null if same)
  exchangeRate: string | null; // decimal string rate (null if same)
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

  const preferredCurrency = exhibitorAccount.preferredCurrency || "EUR";

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

    // Calculate current pricing with currency conversion
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
        return {
          success: false,
          error: "TERRITORY_NOT_AVAILABLE" as CheckoutError,
          errorDetails: {
            itemId: item.id,
            filmTitle: item.film.title,
            message: `Currency conversion failed: ${filmCurrency} → ${preferredCurrency}`,
          },
        };
      }
      catalogPriceInExhibitorCurrency = converted;
      exchangeRate = (converted / filmPrice.price).toFixed(6);
    }

    const pricing = calculatePricing({
      catalogPrice: catalogPriceInExhibitorCurrency,
      currency: preferredCurrency,
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
      catalogPrice: catalogPriceInExhibitorCurrency,
      currency: preferredCurrency,
      platformMarginRate: settings.platformMarginRate,
      deliveryFees: settings.deliveryFees,
      commissionRate,
      displayedPrice: pricing.displayedPrice,
      rightsHolderAmount: pricing.rightsHolderAmount,
      timelessAmount: pricing.timelessAmount,
      originalCatalogPrice: needsConversion ? filmPrice.price : null,
      originalCurrency: needsConversion ? filmCurrency : null,
      exchangeRate,
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

// ─── Checkout Session creation ────────────────────────────────────────────────

export interface CheckoutSessionResult {
  success: boolean;
  redirectUrl?: string;
  error?: CheckoutError;
  errorDetails?: {
    itemId?: string;
    filmTitle?: string;
    message?: string;
  };
}

/**
 * Creates a Stripe Checkout Session for the exhibitor's cart.
 *
 * 1. Validates cart items (pricing, territory, ownership)
 * 2. Verifies all rights holders are Stripe Connect onboarded
 * 3. Creates/updates the Stripe Customer with current billing info
 * 4. Creates a Stripe Checkout Session with automatic_tax
 * 5. Returns the redirect URL
 */
export async function createCheckoutSession(params: {
  exhibitorAccountId: string;
  appUrl: string;
  locale: string;
}): Promise<CheckoutSessionResult> {
  const { exhibitorAccountId, appUrl, locale } = params;

  // 1. Validate cart
  const validation = await validateCheckout({ exhibitorAccountId });
  if (!validation.success || !validation.validatedItems) {
    return {
      success: false,
      error: validation.error || "CART_EMPTY",
      errorDetails: validation.errorDetails,
    };
  }

  const validatedItems = validation.validatedItems;

  // 2. Verify all rights holders are onboarded to Stripe Connect
  const rightsHolderIds = [...new Set(validatedItems.map((item) => item.rightsHolderAccountId))];
  const rightsHolderAccounts = await Promise.all(
    rightsHolderIds.map((id) =>
      db.query.accounts.findFirst({
        where: eq(accounts.id, id),
        columns: {
          id: true,
          companyName: true,
          stripeConnectAccountId: true,
          stripeConnectOnboardingComplete: true,
        },
      })
    )
  );

  for (const rhAccount of rightsHolderAccounts) {
    if (!rhAccount?.stripeConnectOnboardingComplete || !rhAccount.stripeConnectAccountId) {
      const affectedFilm = validatedItems.find(
        (item) => item.rightsHolderAccountId === rhAccount?.id
      );
      return {
        success: false,
        error: "RIGHTS_HOLDER_NOT_ONBOARDED",
        errorDetails: {
          filmTitle: affectedFilm?.filmTitle,
          message: `Rights holder "${rhAccount?.companyName}" has not completed Stripe onboarding`,
        },
      };
    }
  }

  // 3. Get exhibitor account for Stripe Customer creation/update
  const exhibitorAccount = await db.query.accounts.findFirst({
    where: eq(accounts.id, exhibitorAccountId),
  });

  if (!exhibitorAccount) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  // 3b. Verify exhibitor has a complete billing address (required for Stripe Tax)
  if (!exhibitorAccount.address || !exhibitorAccount.city || !exhibitorAccount.postalCode) {
    return { success: false, error: "ADDRESS_INCOMPLETE" };
  }

  try {
    const customer = await getOrUpdateStripeCustomer({
      stripeCustomerId: exhibitorAccount.stripeCustomerId,
      email: exhibitorAccount.contactEmail || "",
      name: exhibitorAccount.companyName,
      phone: exhibitorAccount.contactPhone,
      vatNumber: exhibitorAccount.vatNumber,
      address: {
        line1: exhibitorAccount.address,
        city: exhibitorAccount.city,
        postal_code: exhibitorAccount.postalCode,
        country: exhibitorAccount.country,
      },
      metadata: {
        timeless_account_id: exhibitorAccountId,
        account_type: "exhibitor",
      },
    });

    // Persist stripeCustomerId if newly created
    if (!exhibitorAccount.stripeCustomerId) {
      await db
        .update(accounts)
        .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
        .where(eq(accounts.id, exhibitorAccountId));
    }

    // 4. Build Stripe Checkout line items
    const currency = validatedItems[0]!.currency;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = validatedItems.map(
      (item) => ({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: item.filmTitle,
            metadata: {
              film_id: item.filmId,
              cinema_name: item.cinemaName,
              room_name: item.roomName,
            },
          },
          unit_amount: item.displayedPrice,
          tax_behavior: "exclusive",
        },
        quantity: item.screeningCount,
      })
    );

    // Add delivery fees as a separate line item (per film, not per screening)
    const deliveryFeesPerItem = validatedItems[0]!.deliveryFees;
    if (deliveryFeesPerItem > 0) {
      lineItems.push({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: DELIVERY_FEES_LABEL[locale] || DELIVERY_FEES_LABEL.en!,
          },
          unit_amount: deliveryFeesPerItem,
          tax_behavior: "exclusive",
        },
        quantity: validatedItems.length,
      });
    }

    const cartItemIds = validatedItems.map((item) => item.id);
    const metadata = {
      exhibitor_account_id: exhibitorAccountId,
      cart_item_ids: JSON.stringify(cartItemIds),
    };

    // 5. Create Stripe Checkout Session
    const session = await createStripeCheckoutSession({
      lineItems,
      customerId: customer.id,
      currency,
      successUrl: `${appUrl}/${locale}/orders?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/${locale}/cart`,
      metadata,
    });

    if (!session.url) {
      return { success: false, error: "STRIPE_ERROR" };
    }

    return { success: true, redirectUrl: session.url };
  } catch (error) {
    console.error("Failed to create checkout session:", error);
    return { success: false, error: "STRIPE_ERROR" };
  }
}

// ─── Request Checkout Session ─────────────────────────────────────────────────

/**
 * Creates a Stripe Checkout Session for a validated (approved) request.
 *
 * 1. Verifies request exists, is approved, belongs to exhibitor, not expired
 * 2. Verifies rights holder is Stripe Connect onboarded
 * 3. Creates/updates Stripe Customer
 * 4. Creates Checkout Session with request pricing snapshot
 * 5. Returns the redirect URL
 */
export async function createRequestCheckoutSession(params: {
  requestId: string;
  exhibitorAccountId: string;
  appUrl: string;
  locale: string;
}): Promise<CheckoutSessionResult> {
  const { requestId, exhibitorAccountId, appUrl, locale } = params;

  // 1. Verify request
  const request = await db.query.requests.findFirst({
    where: and(eq(requests.id, requestId), eq(requests.exhibitorAccountId, exhibitorAccountId)),
    with: {
      film: true,
      rightsHolderAccount: {
        columns: {
          id: true,
          companyName: true,
          stripeConnectAccountId: true,
          stripeConnectOnboardingComplete: true,
        },
      },
    },
  });

  if (!request) {
    return { success: false, error: "REQUEST_NOT_FOUND" };
  }

  if (request.status !== "approved") {
    return {
      success: false,
      error: "REQUEST_NOT_APPROVED",
      errorDetails: { message: `Request status is "${request.status}", expected "approved"` },
    };
  }

  // Check expiry
  if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
    return {
      success: false,
      error: "REQUEST_EXPIRED",
      errorDetails: { message: "This request has expired" },
    };
  }

  // 2. Verify rights holder is onboarded
  if (
    !request.rightsHolderAccount.stripeConnectOnboardingComplete ||
    !request.rightsHolderAccount.stripeConnectAccountId
  ) {
    return {
      success: false,
      error: "RIGHTS_HOLDER_NOT_ONBOARDED",
      errorDetails: {
        filmTitle: request.film.title,
        message: `Rights holder "${request.rightsHolderAccount.companyName}" has not completed Stripe onboarding`,
      },
    };
  }

  // 3. Get exhibitor account
  const exhibitorAccount = await db.query.accounts.findFirst({
    where: eq(accounts.id, exhibitorAccountId),
  });

  if (!exhibitorAccount) {
    return { success: false, error: "UNAUTHORIZED" };
  }

  // 3b. Verify exhibitor has a complete billing address (required for Stripe Tax)
  if (!exhibitorAccount.address || !exhibitorAccount.city || !exhibitorAccount.postalCode) {
    return { success: false, error: "ADDRESS_INCOMPLETE" };
  }

  try {
    const customer = await getOrUpdateStripeCustomer({
      stripeCustomerId: exhibitorAccount.stripeCustomerId,
      email: exhibitorAccount.contactEmail || "",
      name: exhibitorAccount.companyName,
      phone: exhibitorAccount.contactPhone,
      vatNumber: exhibitorAccount.vatNumber,
      address: {
        line1: exhibitorAccount.address,
        city: exhibitorAccount.city,
        postal_code: exhibitorAccount.postalCode,
        country: exhibitorAccount.country,
      },
      metadata: {
        timeless_account_id: exhibitorAccountId,
        account_type: "exhibitor",
      },
    });

    // Persist stripeCustomerId if newly created
    if (!exhibitorAccount.stripeCustomerId) {
      await db
        .update(accounts)
        .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
        .where(eq(accounts.id, exhibitorAccountId));
    }

    // 4. Build Stripe Checkout line items using request's snapshot pricing
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: request.currency.toLowerCase(),
          product_data: {
            name: request.film.title,
            metadata: {
              film_id: request.filmId,
              request_id: requestId,
            },
          },
          unit_amount: request.displayedPrice,
          tax_behavior: "exclusive",
        },
        quantity: request.screeningCount,
      },
    ];

    // Add delivery fees as a separate line item (per film, not per screening)
    if (request.deliveryFees > 0) {
      lineItems.push({
        price_data: {
          currency: request.currency.toLowerCase(),
          product_data: {
            name: DELIVERY_FEES_LABEL[locale] || DELIVERY_FEES_LABEL.en!,
          },
          unit_amount: request.deliveryFees,
          tax_behavior: "exclusive",
        },
        quantity: 1, // 1 film for a request
      });
    }

    const metadata = {
      exhibitor_account_id: exhibitorAccountId,
      request_id: requestId,
      rights_holder_account_id: request.rightsHolderAccountId,
    };

    // 5. Create Stripe Checkout Session
    const session = await createStripeCheckoutSession({
      lineItems,
      customerId: customer.id,
      currency: request.currency,
      successUrl: `${appUrl}/${locale}/requests?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/${locale}/requests`,
      metadata,
    });

    if (!session.url) {
      return { success: false, error: "STRIPE_ERROR" };
    }

    return { success: true, redirectUrl: session.url };
  } catch (error) {
    console.error("Failed to create request checkout session:", error);
    return { success: false, error: "STRIPE_ERROR" };
  }
}
