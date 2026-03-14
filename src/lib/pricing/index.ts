import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";

// Re-export pure calculation functions (safe for client components)
export { calculatePricing, calculateRightsHolderTaxAmount } from "./calculations";
export type { PricingParams, PricingResult, RightsHolderTaxParams } from "./calculations";

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

// ─── Commission resolution ────────────────────────────────────────────────

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
