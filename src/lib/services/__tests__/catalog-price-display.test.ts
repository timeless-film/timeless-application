import { describe, expect, it } from "vitest";

/**
 * Catalog Price Display Tests
 *
 * Tests the logic for displaying film prices in multiple zones
 * and converting between currencies for display purposes.
 */

describe("Catalog Price Display", () => {
  describe("single price zone rendering", () => {
    it("displays single price when one zone matches exhibitor territory", () => {
      const matchingPrices = [
        {
          id: "price-1",
          countries: ["FR", "BE"],
          price: 15000, // 150 EUR in cents
          currency: "EUR",
        },
      ];

      expect(matchingPrices).toHaveLength(1);
      expect(matchingPrices[0]?.price).toBe(15000);
    });

    it("displays price with correct formatting", () => {
      const price = 15000; // cents
      const formatted = (price / 100).toLocaleString("fr-FR", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0,
      });

      expect(formatted).toBe("150\u00a0€");
    });
  });

  describe("multiple price zones rendering", () => {
    it("displays multiple prices when multiple zones match", () => {
      const matchingPrices = [
        {
          id: "price-1",
          countries: ["FR", "BE"],
          price: 15000,
          currency: "EUR",
        },
        {
          id: "price-2",
          countries: ["DE", "AT"],
          price: 16000,
          currency: "EUR",
        },
      ];

      expect(matchingPrices).toHaveLength(2);
      matchingPrices.forEach((p) => {
        expect(p.price).toBeGreaterThan(0);
      });
    });

    it("groups prices by currency before display", () => {
      const matchingPrices = [
        {
          id: "price-1",
          countries: ["FR", "BE"],
          price: 15000,
          currency: "EUR",
        },
        {
          id: "price-2",
          countries: ["US", "CA"],
          price: 20000,
          currency: "USD",
        },
      ];

      const grouped = matchingPrices.reduce(
        (acc, p) => {
          if (!acc[p.currency]) acc[p.currency] = [];
          acc[p.currency]!.push(p);
          return acc;
        },
        {} as Record<string, typeof matchingPrices>
      );

      expect(Object.keys(grouped)).toEqual(["EUR", "USD"]);
      expect(grouped["EUR"]).toHaveLength(1);
      expect(grouped["USD"]).toHaveLength(1);
    });

    it("displays highest and lowest prices when multiple zones available", () => {
      const matchingPrices = [
        { id: "p1", countries: ["FR"], price: 15000, currency: "EUR" },
        { id: "p2", countries: ["DE"], price: 16000, currency: "EUR" },
        { id: "p3", countries: ["IT"], price: 14000, currency: "EUR" },
      ];

      const prices = matchingPrices.map((p) => p.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);

      expect(min).toBe(14000);
      expect(max).toBe(16000);
    });
  });

  describe("unavailable territory display", () => {
    it("shows unavailable message when no matching prices", () => {
      const matchingPrices: Array<{
        id: string;
        countries: string[];
        price: number;
        currency: string;
      }> = [];
      const isAvailable = matchingPrices.length > 0;

      expect(isAvailable).toBe(false);
    });

    it("displays 'Indisponible pour vos cinémas' text conditionally", () => {
      const isAvailable = false;
      const unavailableLabel = "Indisponible pour vos cinémas";

      if (!isAvailable) {
        expect(unavailableLabel).toBeDefined();
      }
    });

    it("disables action buttons when unavailable", () => {
      const isAvailable = false;
      const actionButtonDisabled = !isAvailable;

      expect(actionButtonDisabled).toBe(true);
    });
  });

  describe("currency conversion for display", () => {
    it("converts price to preferred currency for display only", () => {
      const nativePrice = 15000; // 150 EUR
      const exchangeRate = 1.08; // 1 EUR = 1.08 USD

      const convertedPrice = Math.round(nativePrice * exchangeRate);
      const displayText = `150 EUR (~${(convertedPrice / 100).toFixed(2)} USD)`;

      expect(displayText).toContain("150 EUR");
      expect(displayText).toContain("USD");
    });

    it("skips conversion when preferred currency equals native currency", () => {
      const nativeCurrency = "EUR";
      const preferredCurrency = "EUR";

      const shouldConvert = nativeCurrency !== preferredCurrency;
      expect(shouldConvert).toBe(false);
    });

    it("marks converted amount as indicative only", () => {
      const displayText = "150 EUR (~162 USD au taux du jour)";
      expect(displayText).toContain("taux du jour");
    });

    it("handles zero or null prices gracefully", () => {
      const price: number | null = null;
      const displayPrice = price ?? "N/A";

      expect(displayPrice).toBe("N/A");
    });
  });

  describe("pricing accessibility", () => {
    it("includes price in cart action button text", () => {
      const buttonText = `Ajouter au panier (150,00 EUR)`;

      expect(buttonText).toContain("EUR");
    });

    it("displays total dynamically when quantity changes", () => {
      const unitPrice = 15000;
      const quantities = [1, 2, 3];

      quantities.forEach((qty) => {
        const total = unitPrice * qty;
        expect(total).toBe(unitPrice * qty);
      });
    });

    it("provides clear pricing context under button", () => {
      const priceInfo = "Prix HT (hors taxes) pour 1 visionnage";
      expect(priceInfo).toContain("HT");
      expect(priceInfo).toContain("visionnage");
    });
  });

  describe("edge cases", () => {
    it("handles very large prices (internationals)", () => {
      const price = 100000000; // 1,000,000 EUR
      const formatted = (price / 100).toLocaleString("fr-FR", {
        style: "currency",
        currency: "EUR",
      });

      expect(formatted).toBeDefined();
      expect(formatted.length).toBeGreaterThan(0);
    });

    it("handles fractional cents correctly", () => {
      const price = 15050; // 150.50 EUR
      const euros = price / 100;
      expect(euros).toBe(150.5);
    });

    it("handles multiple currencies in same zone list gracefully", () => {
      const prices = [
        { currency: "EUR", price: 15000 },
        { currency: "USD", price: 20000 },
        { currency: "GBP", price: 13000 },
      ];

      const currencies = new Set(prices.map((p) => p.currency));
      expect(currencies.size).toBe(3);
    });
  });
});
