/**
 * Pure pricing calculation functions.
 * Safe to use in client components — no DB or server-only imports.
 */

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

export interface RightsHolderTaxParams {
  taxAmount: number; // Total VAT on the order (cents)
  rightsHolderAmount: number; // RH per-screening HT amount (cents)
  screeningCount: number;
  subtotal: number; // Sum of displayedPrice × screeningCount for all items (cents)
  deliveryFeesTotal: number; // Total delivery fees for the order (cents)
}

/**
 * Calculates the rights holder's proportional share of VAT (agent model).
 *
 * Formula: round(taxAmount × (rhHtAmount / htBase))
 * Where rhHtAmount = rightsHolderAmount × screeningCount
 *       htBase     = subtotal + deliveryFeesTotal
 *
 * Returns 0 when taxAmount is 0 (reverse charge) or htBase is 0.
 */
export function calculateRightsHolderTaxAmount(params: RightsHolderTaxParams): number {
  const { taxAmount, rightsHolderAmount, screeningCount, subtotal, deliveryFeesTotal } = params;

  if (taxAmount === 0) return 0;

  const htBase = subtotal + deliveryFeesTotal;
  if (htBase === 0) return 0;

  const rhHtAmount = rightsHolderAmount * screeningCount;
  return Math.round(taxAmount * (rhHtAmount / htBase));
}
