import { describe, expect, it } from "vitest";

import {
  calculatePricing,
  calculateRightsHolderTaxAmount,
  formatAmount,
  resolveCommissionRate,
} from "@/lib/pricing";

describe("calculatePricing", () => {
  it("calculates basic pricing without delivery fees", () => {
    const result = calculatePricing({
      catalogPrice: 10000, // €100.00
      currency: "EUR",
      platformMarginRate: 0.2, // 20%
      deliveryFees: 0,
      commissionRate: 0.1, // 10%
    });

    expect(result.displayedPrice).toBe(12000); // €100 × 1.20 = €120.00
    expect(result.rightsHolderAmount).toBe(9000); // €100 × 0.90 = €90.00
    expect(result.timelessAmount).toBe(3000); // €120 - €90 = €30.00
    expect(result.currency).toBe("EUR");
  });

  it("does not include delivery fees in displayed price", () => {
    const result = calculatePricing({
      catalogPrice: 10000,
      currency: "EUR",
      platformMarginRate: 0.2,
      deliveryFees: 5000, // €50.00
      commissionRate: 0.1,
    });

    expect(result.displayedPrice).toBe(12000); // €100 × 1.20 = €120.00 (no delivery)
    expect(result.deliveryFees).toBe(5000); // preserved but separate
    expect(result.rightsHolderAmount).toBe(9000); // unchanged
    expect(result.timelessAmount).toBe(3000); // €120 - €90 = €30.00
  });

  it("handles zero margin", () => {
    const result = calculatePricing({
      catalogPrice: 10000,
      currency: "EUR",
      platformMarginRate: 0,
      deliveryFees: 0,
      commissionRate: 0.1,
    });

    expect(result.displayedPrice).toBe(10000);
    expect(result.rightsHolderAmount).toBe(9000);
    expect(result.timelessAmount).toBe(1000);
  });

  it("handles zero commission", () => {
    const result = calculatePricing({
      catalogPrice: 10000,
      currency: "EUR",
      platformMarginRate: 0.2,
      deliveryFees: 0,
      commissionRate: 0,
    });

    expect(result.displayedPrice).toBe(12000);
    expect(result.rightsHolderAmount).toBe(10000);
    expect(result.timelessAmount).toBe(2000);
  });

  it("handles zero catalog price", () => {
    const result = calculatePricing({
      catalogPrice: 0,
      currency: "EUR",
      platformMarginRate: 0.2,
      deliveryFees: 5000,
      commissionRate: 0.1,
    });

    expect(result.displayedPrice).toBe(0); // 0 × 1.20 = 0
    expect(result.deliveryFees).toBe(5000); // separate
    expect(result.rightsHolderAmount).toBe(0);
    expect(result.timelessAmount).toBe(0);
  });

  it("rounds to nearest cent", () => {
    // 333 × 1.2 = 399.6 → rounds to 400
    const result = calculatePricing({
      catalogPrice: 333,
      currency: "EUR",
      platformMarginRate: 0.2,
      deliveryFees: 0,
      commissionRate: 0.1,
    });

    expect(result.displayedPrice).toBe(400); // Math.round(399.6)
    expect(result.rightsHolderAmount).toBe(300); // Math.round(299.7)
    expect(result.timelessAmount).toBe(100); // 400 - 300
  });

  it("preserves all input params in output", () => {
    const params = {
      catalogPrice: 10000,
      currency: "USD",
      platformMarginRate: 0.15,
      deliveryFees: 2000,
      commissionRate: 0.05,
    };

    const result = calculatePricing(params);

    expect(result.catalogPrice).toBe(params.catalogPrice);
    expect(result.platformMarginRate).toBe(params.platformMarginRate);
    expect(result.deliveryFees).toBe(params.deliveryFees);
    expect(result.commissionRate).toBe(params.commissionRate);
    expect(result.currency).toBe(params.currency);
  });

  it("ensures timelessAmount = displayedPrice - rightsHolderAmount", () => {
    const result = calculatePricing({
      catalogPrice: 7777,
      currency: "EUR",
      platformMarginRate: 0.25,
      deliveryFees: 3333,
      commissionRate: 0.12,
    });

    expect(result.timelessAmount).toBe(result.displayedPrice - result.rightsHolderAmount);
  });

  it("handles converted catalog price (cross-currency)", () => {
    // Simulates USD→EUR conversion: 20000 USD × 0.92 = 18400 EUR cents
    const convertedCatalogPrice = Math.round(20000 * 0.92);

    const result = calculatePricing({
      catalogPrice: convertedCatalogPrice, // 18400 (already converted)
      currency: "EUR",
      platformMarginRate: 0.2,
      deliveryFees: 5000,
      commissionRate: 0.1,
    });

    expect(result.displayedPrice).toBe(22080); // 18400 × 1.20 = 22080
    expect(result.rightsHolderAmount).toBe(16560); // 18400 × 0.90 = 16560
    expect(result.timelessAmount).toBe(5520); // 22080 - 16560 = 5520
    expect(result.deliveryFees).toBe(5000); // preserved, separate
    expect(result.currency).toBe("EUR");
  });
});

describe("resolveCommissionRate", () => {
  it("returns parsed account-level rate when provided", () => {
    expect(resolveCommissionRate("0.15", 0.1)).toBe(0.15);
  });

  it("returns default rate when account rate is null", () => {
    expect(resolveCommissionRate(null, 0.1)).toBe(0.1);
  });

  it("returns default rate when account rate is undefined", () => {
    expect(resolveCommissionRate(undefined, 0.1)).toBe(0.1);
  });

  it("returns default rate when account rate is empty string", () => {
    expect(resolveCommissionRate("", 0.1)).toBe(0.1);
  });

  it("handles zero account rate", () => {
    expect(resolveCommissionRate("0", 0.1)).toBe(0);
  });

  it("handles decimal string rates", () => {
    expect(resolveCommissionRate("0.075", 0.1)).toBe(0.075);
  });
});

describe("formatAmount", () => {
  it("formats EUR amount with default locale", () => {
    const result = formatAmount(15000, "EUR");
    expect(result).toContain("150");
    expect(result).toContain("00");
  });

  it("formats USD amount", () => {
    const result = formatAmount(9999, "USD");
    expect(result).toContain("99");
    expect(result).toContain("99");
  });

  it("formats zero amount", () => {
    const result = formatAmount(0, "EUR");
    expect(result).toContain("0");
  });

  it("handles lowercase currency code", () => {
    const result = formatAmount(5000, "eur");
    expect(result).toContain("50");
  });

  it("formats with specified locale", () => {
    const result = formatAmount(15000, "EUR", "fr-FR");
    expect(result).toContain("150");
  });
});

describe("calculateRightsHolderTaxAmount", () => {
  it("calculates proportional RH tax share", () => {
    // Order: subtotal=12000 + delivery=5000 = 17000 HT
    // RH amount: 9000 × 1 screening = 9000
    // Tax: 3400 (20%)
    // RH share: round(3400 × 9000/17000) = round(1800) = 1800
    const result = calculateRightsHolderTaxAmount({
      taxAmount: 3400,
      rightsHolderAmount: 9000,
      screeningCount: 1,
      subtotal: 12000,
      deliveryFeesTotal: 5000,
    });

    expect(result).toBe(1800);
  });

  it("multiplies by screeningCount", () => {
    const result = calculateRightsHolderTaxAmount({
      taxAmount: 3400,
      rightsHolderAmount: 9000,
      screeningCount: 3,
      subtotal: 36000, // 12000 × 3
      deliveryFeesTotal: 5000,
    });

    // rhHtAmount = 9000 × 3 = 27000
    // htBase = 36000 + 5000 = 41000
    // round(3400 × 27000 / 41000) = round(2239.02...) = 2239
    expect(result).toBe(2239);
  });

  it("returns 0 when taxAmount is 0 (reverse charge)", () => {
    const result = calculateRightsHolderTaxAmount({
      taxAmount: 0,
      rightsHolderAmount: 9000,
      screeningCount: 1,
      subtotal: 12000,
      deliveryFeesTotal: 5000,
    });

    expect(result).toBe(0);
  });

  it("returns 0 when htBase is 0", () => {
    const result = calculateRightsHolderTaxAmount({
      taxAmount: 1000,
      rightsHolderAmount: 0,
      screeningCount: 1,
      subtotal: 0,
      deliveryFeesTotal: 0,
    });

    expect(result).toBe(0);
  });

  it("rounds to nearest cent", () => {
    // rhHtAmount = 7777 × 1 = 7777
    // htBase = 10000 + 3000 = 13000
    // 2000 × 7777 / 13000 = 1196.46... → 1196
    const result = calculateRightsHolderTaxAmount({
      taxAmount: 2000,
      rightsHolderAmount: 7777,
      screeningCount: 1,
      subtotal: 10000,
      deliveryFeesTotal: 3000,
    });

    expect(result).toBe(1196);
  });

  it("handles no delivery fees", () => {
    // htBase = 12000 + 0 = 12000
    // rhHtAmount = 9000
    // 2400 × 9000/12000 = 1800
    const result = calculateRightsHolderTaxAmount({
      taxAmount: 2400,
      rightsHolderAmount: 9000,
      screeningCount: 1,
      subtotal: 12000,
      deliveryFeesTotal: 0,
    });

    expect(result).toBe(1800);
  });
});
