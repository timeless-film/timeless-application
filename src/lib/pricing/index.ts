import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";

export interface PricingParams {
  catalogPrice: number; // In cents
  currency: string;
  platformMarginRate: number; // e.g. 0.20 for 20%
  deliveryFees: number; // In cents
  commissionRate: number; // e.g. 0.10 for 10%
}

export interface PricingResult {
  catalogPrice: number;
  platformMarginRate: number;
  deliveryFees: number;
  commissionRate: number;
  displayedPrice: number; // What the exhibitor sees (excl. tax)
  rightsHolderAmount: number; // What the rights holder receives
  timelessAmount: number; // What TIMELESS retains
  currency: string;
}

/**
 * Calculates the displayed price and split for an order line.
 *
 * Formula:
 *   displayedPrice = catalogPrice × (1 + marginRate)
 *   rightsHolderAmount = catalogPrice × (1 - commissionRate)
 *   timelessAmount = displayedPrice - rightsHolderAmount
 *
 * Delivery fees are NOT included in displayedPrice — they are tracked
 * separately and added as a distinct line item at checkout.
 * Delivery fees are per film (not per screening).
 */
export function calculatePricing(params: PricingParams): PricingResult {
  const { catalogPrice, platformMarginRate, deliveryFees, commissionRate, currency } = params;

  const displayedPrice = Math.round(catalogPrice * (1 + platformMarginRate));
  const rightsHolderAmount = Math.round(catalogPrice * (1 - commissionRate));
  const timelessAmount = displayedPrice - rightsHolderAmount;

  return {
    catalogPrice,
    platformMarginRate,
    deliveryFees,
    commissionRate,
    displayedPrice,
    rightsHolderAmount,
    timelessAmount,
    currency,
  };
}

/**
 * Fetches the current pricing settings from the DB.
 * Server-side only.
 */
export async function getPlatformPricingSettings() {
  let settings = await db.query.platformSettings.findFirst({
    where: (s, { eq }) => eq(s.id, "global"),
  });

  if (!settings) {
    try {
      await db.insert(platformSettings).values({ id: "global" });
      settings = await db.query.platformSettings.findFirst({
        where: (s, { eq }) => eq(s.id, "global"),
      });
    } catch (error) {
      console.error("Failed to initialize platform settings:", error);
    }
  }

  if (!settings) {
    throw new Error("Platform settings not found");
  }

  return {
    platformMarginRate: parseFloat(settings.platformMarginRate),
    deliveryFees: settings.deliveryFees,
    defaultCommissionRate: parseFloat(settings.defaultCommissionRate),
    requestExpirationDays: settings.requestExpirationDays,
    requestUrgencyDaysBeforeStart: settings.requestUrgencyDaysBeforeStart,
    opsEmail: settings.opsEmail,
  };
}

/**
 * Returns the commission rate for a given rights holder.
 * Uses the account-specific rate if set, falls back to the global default.
 */
export function resolveCommissionRate(
  rightsHolderCommissionRate: string | null | undefined,
  defaultRate: number
): number {
  if (rightsHolderCommissionRate) {
    return parseFloat(rightsHolderCommissionRate);
  }
  return defaultRate;
}

/**
 * Formats an amount in cents to a displayable string.
 * e.g. 15000, "EUR" → "€150.00"
 */
export function formatAmount(amountInCents: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100);
}
