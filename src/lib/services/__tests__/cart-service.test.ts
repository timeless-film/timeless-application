import { describe, expect, it } from "vitest";

import { validateDateRange } from "../cart-service";

describe("cart-service", () => {
  describe("validateDateRange", () => {
    it("allows no dates", () => {
      const result = validateDateRange({});
      expect(result.valid).toBe(true);
    });

    it("allows startDate alone (>=J+1)", () => {
      const tomorrow = new Date();
      tomorrow.setUTCHours(0, 0, 0, 0);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const startDate = tomorrow.toISOString().split("T")[0];

      const result = validateDateRange({ startDate });
      expect(result.valid).toBe(true);
    });

    it("rejects startDate < J+1", () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const startDate = today.toISOString().split("T")[0];

      const result = validateDateRange({ startDate });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("INVALID_DATE_RANGE");
    });

    it("rejects endDate without startDate", () => {
      const tomorrow = new Date();
      tomorrow.setUTCHours(0, 0, 0, 0);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const endDate = tomorrow.toISOString().split("T")[0];

      const result = validateDateRange({ endDate });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("INVALID_DATE_RANGE");
    });

    it("allows valid date range (startDate >= J+1, endDate >= startDate)", () => {
      const tomorrow = new Date();
      tomorrow.setUTCHours(0, 0, 0, 0);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const startDate = tomorrow.toISOString().split("T")[0];

      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setUTCDate(dayAfterTomorrow.getUTCDate() + 1);
      const endDate = dayAfterTomorrow.toISOString().split("T")[0];

      const result = validateDateRange({ startDate, endDate });
      expect(result.valid).toBe(true);
    });

    it("allows startDate === endDate (same day screening)", () => {
      const tomorrow = new Date();
      tomorrow.setUTCHours(0, 0, 0, 0);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const startDate = tomorrow.toISOString().split("T")[0];
      const endDate = startDate;

      const result = validateDateRange({ startDate, endDate });
      expect(result.valid).toBe(true);
    });

    it("rejects endDate < startDate", () => {
      const tomorrow = new Date();
      tomorrow.setUTCHours(0, 0, 0, 0);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 2);
      const startDate = tomorrow.toISOString().split("T")[0];

      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setUTCHours(0, 0, 0, 0);
      dayAfterTomorrow.setUTCDate(dayAfterTomorrow.getUTCDate() + 1);
      const endDate = dayAfterTomorrow.toISOString().split("T")[0];

      const result = validateDateRange({ startDate, endDate });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("INVALID_DATE_RANGE");
    });

    it("rejects startDate < J+1 even with valid endDate", () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const startDate = today.toISOString().split("T")[0];

      const tomorrow = new Date();
      tomorrow.setUTCHours(0, 0, 0, 0);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const endDate = tomorrow.toISOString().split("T")[0];

      const result = validateDateRange({ startDate, endDate });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("INVALID_DATE_RANGE");
    });
  });
});
