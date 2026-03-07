import { describe, expect, it } from "vitest";

import { calculatePricing, formatAmount, resolveCommissionRate } from "@/lib/pricing";

describe("calculatePricing", () => {
  it("calculates basic pricing without delivery fees", () => {
    const result = calculatePricing({
      cataloguePrice: 10000, // €100.00
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

  it("includes delivery fees in displayed price", () => {
    const result = calculatePricing({
      cataloguePrice: 10000,
      currency: "EUR",
      platformMarginRate: 0.2,
      deliveryFees: 5000, // €50.00
      commissionRate: 0.1,
    });

    expect(result.displayedPrice).toBe(17000); // €100 × 1.20 + €50 = €170.00
    expect(result.rightsHolderAmount).toBe(9000); // unchanged
    expect(result.timelessAmount).toBe(8000); // €170 - €90 = €80.00
  });

  it("handles zero margin", () => {
    const result = calculatePricing({
      cataloguePrice: 10000,
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
      cataloguePrice: 10000,
      currency: "EUR",
      platformMarginRate: 0.2,
      deliveryFees: 0,
      commissionRate: 0,
    });

    expect(result.displayedPrice).toBe(12000);
    expect(result.rightsHolderAmount).toBe(10000);
    expect(result.timelessAmount).toBe(2000);
  });

  it("handles zero catalogue price", () => {
    const result = calculatePricing({
      cataloguePrice: 0,
      currency: "EUR",
      platformMarginRate: 0.2,
      deliveryFees: 5000,
      commissionRate: 0.1,
    });

    expect(result.displayedPrice).toBe(5000); // only delivery fees
    expect(result.rightsHolderAmount).toBe(0);
    expect(result.timelessAmount).toBe(5000);
  });

  it("rounds to nearest cent", () => {
    // 333 × 1.2 = 399.6 → rounds to 400
    const result = calculatePricing({
      cataloguePrice: 333,
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
      cataloguePrice: 10000,
      currency: "USD",
      platformMarginRate: 0.15,
      deliveryFees: 2000,
      commissionRate: 0.05,
    };

    const result = calculatePricing(params);

    expect(result.cataloguePrice).toBe(params.cataloguePrice);
    expect(result.platformMarginRate).toBe(params.platformMarginRate);
    expect(result.deliveryFees).toBe(params.deliveryFees);
    expect(result.commissionRate).toBe(params.commissionRate);
    expect(result.currency).toBe(params.currency);
  });

  it("ensures timelessAmount = displayedPrice - rightsHolderAmount", () => {
    const result = calculatePricing({
      cataloguePrice: 7777,
      currency: "EUR",
      platformMarginRate: 0.25,
      deliveryFees: 3333,
      commissionRate: 0.12,
    });

    expect(result.timelessAmount).toBe(result.displayedPrice - result.rightsHolderAmount);
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
