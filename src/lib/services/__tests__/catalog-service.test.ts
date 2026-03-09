import { describe, expect, it, vi } from "vitest";

import { checkFilmAvailability } from "../catalog-service";

import type { CountryCode } from "@/lib/countries";

// Mock DB
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      filmPrices: {
        findMany: vi.fn(),
      },
    },
  },
}));

describe("catalog-service", () => {
  describe("checkFilmAvailability", () => {
    it("returns available=false when no account countries", async () => {
      const result = await checkFilmAvailability("film-123", []);

      expect(result.available).toBe(false);
      expect(result.matchingPrices).toEqual([]);
    });

    it("returns available=true when at least one price zone matches", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.query.filmPrices.findMany).mockResolvedValueOnce([
        {
          id: "price-1",
          filmId: "film-123",
          countries: ["FR", "BE"],
          price: 15000,
          currency: "EUR",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await checkFilmAvailability("film-123", ["FR"] as CountryCode[]);

      expect(result.available).toBe(true);
      expect(result.matchingPrices).toHaveLength(1);
      expect(result.matchingPrices[0]?.price).toBe(15000);
    });

    it("returns available=false when no intersection", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.query.filmPrices.findMany).mockResolvedValueOnce([
        {
          id: "price-1",
          filmId: "film-123",
          countries: ["US", "CA"],
          price: 20000,
          currency: "USD",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await checkFilmAvailability("film-123", ["FR", "BE"] as CountryCode[]);

      expect(result.available).toBe(false);
      expect(result.matchingPrices).toEqual([]);
    });

    it("returns multiple matching prices when several zones match", async () => {
      const { db } = await import("@/lib/db");
      vi.mocked(db.query.filmPrices.findMany).mockResolvedValueOnce([
        {
          id: "price-1",
          filmId: "film-123",
          countries: ["FR"],
          price: 15000,
          currency: "EUR",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "price-2",
          filmId: "film-123",
          countries: ["BE", "CH"],
          price: 18000,
          currency: "EUR",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await checkFilmAvailability("film-123", ["FR", "BE"] as CountryCode[]);

      expect(result.available).toBe(true);
      expect(result.matchingPrices).toHaveLength(2);
    });
  });
});
