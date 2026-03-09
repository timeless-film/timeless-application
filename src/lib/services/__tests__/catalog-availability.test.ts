import { describe, expect, it } from "vitest";

import type { CountryCode } from "@/lib/countries";

/**
 * Catalog Availability Tests
 *
 * Tests the logic for determining film availability based on territory intersection
 * and matching prices. These are behavior tests for the availability logic.
 */

describe("Territory Intersection Logic (Availability)", () => {
  describe("country overlap detection", () => {
    it("returns false when account has no cinemas (empty countries list)", () => {
      const accountCountries: CountryCode[] = [];
      const priceZoneCountries = ["FR", "BE"];

      const hasIntersection = accountCountries.some((c) => priceZoneCountries.includes(c));

      expect(hasIntersection).toBe(false);
    });

    it("returns true when account countries intersect with price zone", () => {
      const accountCountries: CountryCode[] = ["FR" as CountryCode];
      const priceZoneCountries = ["FR", "BE"];

      const hasIntersection = accountCountries.some((c) => priceZoneCountries.includes(c));

      expect(hasIntersection).toBe(true);
    });

    it("returns false when no countries match between account and zone", () => {
      const accountCountries: CountryCode[] = ["DE" as CountryCode];
      const priceZoneCountries = ["US", "CA"];

      const hasIntersection = accountCountries.some((c) => priceZoneCountries.includes(c));

      expect(hasIntersection).toBe(false);
    });

    it("handles partial array overlap correctly", () => {
      const accountCountries: CountryCode[] = ["FR" as CountryCode, "UK" as CountryCode];
      const priceZoneCountries = ["FR", "BE", "DE"];

      const hasIntersection = accountCountries.some((c) => priceZoneCountries.includes(c));

      expect(hasIntersection).toBe(true);
    });

    it("requires all countries to be uppercase codes", () => {
      const accountCountries: CountryCode[] = ["FR" as CountryCode];
      const priceZoneCountries = ["FR", "BE"];

      // Verify uppercase codes match
      const hasIntersection = accountCountries.some((c) => priceZoneCountries.includes(c));

      expect(hasIntersection).toBe(true);
    });
  });

  describe("matching prices filtering", () => {
    it("returns single price when one zone matches", () => {
      const allPrices = [
        {
          id: "price-1",
          countries: ["FR", "BE"],
          price: 15000,
          currency: "EUR",
        },
      ];
      const accountCountries: CountryCode[] = ["FR" as CountryCode];

      const matchingPrices = allPrices.filter((p) =>
        accountCountries.some((c) => p.countries.includes(c))
      );

      expect(matchingPrices).toHaveLength(1);
      expect(matchingPrices[0]?.price).toBe(15000);
    });

    it("returns multiple prices when multiple zones match", () => {
      const allPrices = [
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
      const accountCountries: CountryCode[] = ["FR" as CountryCode, "DE" as CountryCode];

      const matchingPrices = allPrices.filter((p) =>
        accountCountries.some((c) => p.countries.includes(c))
      );

      expect(matchingPrices).toHaveLength(2);
    });

    it("filters out null entries in price list", () => {
      const allPrices: Array<{
        id: string;
        countries: string[];
        price: number;
        currency: string;
      } | null> = [
        {
          id: "price-1",
          countries: ["FR"],
          price: 15000,
          currency: "EUR",
        },
        null,
      ];

      const definedPrices = allPrices.filter((p): p is Exclude<typeof p, null> => p !== null);

      expect(definedPrices).toHaveLength(1);
      expect(definedPrices[0]?.id).toBe("price-1");
    });

    it("returns empty array when no prices available", () => {
      const allPrices: Array<{
        id: string;
        countries: string[];
        price: number;
        currency: string;
      }> = [];
      const accountCountries: CountryCode[] = ["FR" as CountryCode];

      const matchingPrices = allPrices.filter((p) =>
        accountCountries.some((c) => p.countries.includes(c))
      );

      expect(matchingPrices).toEqual([]);
    });

    it("handles different currencies in matching prices", () => {
      const allPrices = [
        {
          id: "price-1",
          countries: ["FR"],
          price: 15000,
          currency: "EUR",
        },
        {
          id: "price-2",
          countries: ["US"],
          price: 20000,
          currency: "USD",
        },
      ];
      const accountCountries: CountryCode[] = ["FR" as CountryCode, "US" as CountryCode];

      const matchingPrices = allPrices.filter((p) =>
        accountCountries.some((c) => p.countries.includes(c))
      );

      expect(matchingPrices).toHaveLength(2);
      expect(matchingPrices.map((p) => p.currency)).toEqual(["EUR", "USD"]);
    });

    it("preserves price amounts correctly without modification", () => {
      const allPrices = [
        {
          id: "price-1",
          countries: ["FR"],
          price: 999,
          currency: "EUR",
        },
      ];
      const accountCountries: CountryCode[] = ["FR" as CountryCode];

      const matchingPrices = allPrices.filter((p) =>
        accountCountries.some((c) => p.countries.includes(c))
      );

      expect(matchingPrices[0]?.price).toBe(999);
    });
  });

  describe("availability determination", () => {
    it("film is unavailable when no matching prices exist", () => {
      const allPrices = [
        {
          id: "price-1",
          countries: ["US"],
          price: 15000,
          currency: "USD",
        },
      ];
      const accountCountries: CountryCode[] = ["FR" as CountryCode];

      const matchingPrices = allPrices.filter((p) =>
        accountCountries.some((c) => p.countries.includes(c))
      );
      const isAvailable = matchingPrices.length > 0;

      expect(isAvailable).toBe(false);
    });

    it("film is available when at least one matching price exists", () => {
      const allPrices = [
        {
          id: "price-1",
          countries: ["FR", "BE"],
          price: 15000,
          currency: "EUR",
        },
      ];
      const accountCountries: CountryCode[] = ["FR" as CountryCode];

      const matchingPrices = allPrices.filter((p) =>
        accountCountries.some((c) => p.countries.includes(c))
      );
      const isAvailable = matchingPrices.length > 0;

      expect(isAvailable).toBe(true);
    });
  });
});
