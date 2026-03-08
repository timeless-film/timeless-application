import { describe, expect, it } from "vitest";

import { getCurrencyOptions } from "@/lib/currencies";

describe("getCurrencyOptions", () => {
  it("returns a non-empty array", () => {
    const options = getCurrencyOptions("en");
    expect(options.length).toBeGreaterThan(0);
  });

  it("returns ISO 4217 codes (3 uppercase letters)", () => {
    const options = getCurrencyOptions("en");
    for (const option of options) {
      expect(option.value).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("includes major Stripe currencies (EUR, USD, GBP)", () => {
    const options = getCurrencyOptions("en");
    const codes = options.map((o) => o.value);
    expect(codes).toContain("EUR");
    expect(codes).toContain("USD");
    expect(codes).toContain("GBP");
  });

  it("formats labels as 'CODE — Localized Name'", () => {
    const options = getCurrencyOptions("en");
    const eur = options.find((o) => o.value === "EUR");
    expect(eur?.label).toMatch(/^EUR — .+$/);
  });

  it("returns localized currency names in French", () => {
    const options = getCurrencyOptions("fr");
    const eur = options.find((o) => o.value === "EUR");
    expect(eur?.label).toContain("EUR");
    expect(eur?.label).toContain("euro");
  });

  it("returns localized currency names in English", () => {
    const options = getCurrencyOptions("en");
    const usd = options.find((o) => o.value === "USD");
    expect(usd?.label).toContain("USD");
    expect(usd?.label).toContain("Dollar");
  });

  it("returns results sorted alphabetically by label", () => {
    const options = getCurrencyOptions("en");
    const labels = options.map((o) => o.label);
    const sorted = [...labels].sort((a, b) => a.localeCompare(b, "en"));
    expect(labels).toEqual(sorted);
  });
});
