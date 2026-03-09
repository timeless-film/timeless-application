import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearRatesCache,
  convertCurrency,
  convertCurrencyWithFallback,
  formatWithConversion,
  getExchangeRates,
} from "../exchange-rate-service";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRates = {
  amount: 1,
  base: "EUR",
  date: "2024-03-15",
  rates: {
    USD: 1.08,
    GBP: 0.85,
    JPY: 163.5,
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Exchange Rate Service", () => {
  beforeEach(() => {
    clearRatesCache();
    vi.restoreAllMocks();
  });

  describe("getExchangeRates", () => {
    it("fetches rates from Frankfurter API", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRates,
      });

      const rates = await getExchangeRates();

      expect(rates).not.toBeNull();
      expect(rates?.base).toBe("EUR");
      expect(rates?.rates.USD).toBe(1.08);
    });

    it("returns cached rates on second call (within 1 hour)", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRates,
      });

      // First call — fetch
      const rates1 = await getExchangeRates();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call — cached
      const rates2 = await getExchangeRates();
      expect(global.fetch).toHaveBeenCalledTimes(1); // No new fetch
      expect(rates2).toBe(rates1);
    });

    it("returns null when API is down", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const rates = await getExchangeRates();

      expect(rates).toBeNull();
    });

    it("returns null when API returns non-200", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const rates = await getExchangeRates();

      expect(rates).toBeNull();
    });

    // TODO: Add timeout test (requires proper AbortController mocking)
  });

  describe("convertCurrency", () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRates,
      });
    });

    it("returns same amount for same currency", async () => {
      const result = await convertCurrency(10000, "EUR", "EUR");
      expect(result).toBe(10000);
    });

    it("converts EUR to USD correctly", async () => {
      const result = await convertCurrency(10000, "EUR", "USD"); // 100 EUR
      expect(result).toBe(10800); // ~108 USD (100 * 1.08)
    });

    it("converts USD to EUR correctly", async () => {
      const result = await convertCurrency(10800, "USD", "EUR"); // 108 USD
      expect(result).toBe(10000); // ~100 EUR (108 / 1.08)
    });

    it("converts between non-EUR currencies", async () => {
      const result = await convertCurrency(10000, "USD", "GBP"); // 100 USD
      // USD → EUR: 100 * (1 / 1.08) = 92.59 EUR
      // EUR → GBP: 92.59 * 0.85 = 78.70 GBP
      expect(result).toBeCloseTo(7870, -1); // Allow ±10 cents rounding
    });

    it("returns null when rates unavailable", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await convertCurrency(10000, "EUR", "USD");
      expect(result).toBeNull();
    });

    it("returns null for unknown currency", async () => {
      const result = await convertCurrency(10000, "EUR", "XYZ");
      expect(result).toBeNull();
    });
  });

  describe("convertCurrencyWithFallback", () => {
    it("returns converted amount on success", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRates,
      });

      const result = await convertCurrencyWithFallback(10000, "EUR", "USD");
      expect(result).toBe(10800);
    });

    it("returns original amount when API fails", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await convertCurrencyWithFallback(10000, "EUR", "USD");
      expect(result).toBe(10000); // Fallback to original
    });
  });

  describe("formatWithConversion", () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockRates,
      });
    });

    it("returns native amount only when currencies match", async () => {
      const result = await formatWithConversion(10000, "EUR", "EUR");
      expect(result).toBe("100.00 EUR");
    });

    it("returns formatted conversion string", async () => {
      const result = await formatWithConversion(10000, "EUR", "USD");
      expect(result).toContain("100.00 EUR");
      expect(result).toContain("108.00 USD");
      expect(result).toContain("2024-03-15");
    });

    it("returns native amount only when conversion fails", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await formatWithConversion(10000, "EUR", "USD");
      expect(result).toBe("100.00 EUR"); // Fallback
    });
  });
});
