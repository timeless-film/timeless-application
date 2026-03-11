import { describe, expect, it } from "vitest";

import {
  calculateRequestExpiry,
  findPriceForCountry,
  formatOrderNumber,
  isRequestExpired,
} from "@/lib/utils";

describe("calculateRequestExpiry", () => {
  it("returns standard expiry when it is earlier than urgency expiry", () => {
    // Start date is far in the future → urgency expiry is also far
    const startDate = new Date("2026-12-01");
    const expirationDays = 3;
    const urgencyDaysBeforeStart = 7;

    const result = calculateRequestExpiry(startDate, expirationDays, urgencyDaysBeforeStart);

    // Standard expiry = now + 3 days
    const expectedStandard = new Date();
    expectedStandard.setDate(expectedStandard.getDate() + expirationDays);

    // Should be close to standard (within a second)
    expect(Math.abs(result.getTime() - expectedStandard.getTime())).toBeLessThan(1000);
  });

  it("returns urgency expiry when start date is imminent", () => {
    // Start date is tomorrow → urgency expiry = tomorrow - 7 = 6 days ago (in the past)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expirationDays = 30; // standard is far in the future
    const urgencyDaysBeforeStart = 7;

    const result = calculateRequestExpiry(tomorrow, expirationDays, urgencyDaysBeforeStart);

    // Urgency expiry = tomorrow - 7 = 6 days ago
    const expectedUrgency = new Date(tomorrow);
    expectedUrgency.setDate(expectedUrgency.getDate() - urgencyDaysBeforeStart);

    expect(Math.abs(result.getTime() - expectedUrgency.getTime())).toBeLessThan(1000);
  });
});

describe("isRequestExpired", () => {
  it("returns true for a past date", () => {
    const past = new Date("2020-01-01");
    expect(isRequestExpired(past)).toBe(true);
  });

  it("returns false for a future date", () => {
    const future = new Date("2030-01-01");
    expect(isRequestExpired(future)).toBe(false);
  });

  it("returns true for one millisecond ago", () => {
    const justPast = new Date(Date.now() - 1);
    expect(isRequestExpired(justPast)).toBe(true);
  });
});

describe("findPriceForCountry", () => {
  const prices = [
    { countries: ["FR", "DE", "IT"], price: 15000, currency: "EUR" },
    { countries: ["US", "CA"], price: 20000, currency: "USD" },
    { countries: ["GB"], price: 12000, currency: "GBP" },
  ];

  it("finds the price for a matching country", () => {
    const result = findPriceForCountry(prices, "FR");
    expect(result).toEqual({ countries: ["FR", "DE", "IT"], price: 15000, currency: "EUR" });
  });

  it("finds price for US", () => {
    const result = findPriceForCountry(prices, "US");
    expect(result).toEqual({ countries: ["US", "CA"], price: 20000, currency: "USD" });
  });

  it("finds price for GB", () => {
    const result = findPriceForCountry(prices, "GB");
    expect(result).toEqual({ countries: ["GB"], price: 12000, currency: "GBP" });
  });

  it("returns null for unknown country", () => {
    expect(findPriceForCountry(prices, "JP")).toBeNull();
  });

  it("handles case-insensitive country input", () => {
    const result = findPriceForCountry(prices, "fr");
    expect(result).toEqual({ countries: ["FR", "DE", "IT"], price: 15000, currency: "EUR" });
  });

  it("returns null for empty prices array", () => {
    expect(findPriceForCountry([], "FR")).toBeNull();
  });
});

describe("formatOrderNumber", () => {
  it("formats single-digit number with zero padding", () => {
    expect(formatOrderNumber(1)).toBe("ORD-000001");
  });

  it("formats typical order number", () => {
    expect(formatOrderNumber(42)).toBe("ORD-000042");
  });

  it("formats large order number", () => {
    expect(formatOrderNumber(123456)).toBe("ORD-123456");
  });

  it("formats number exceeding 6 digits", () => {
    expect(formatOrderNumber(1234567)).toBe("ORD-1234567");
  });

  it("formats zero", () => {
    expect(formatOrderNumber(0)).toBe("ORD-000000");
  });
});
