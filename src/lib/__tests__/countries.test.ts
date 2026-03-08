import { describe, expect, it } from "vitest";

import { getCountryOptions } from "@/lib/countries";

describe("getCountryOptions", () => {
  it("returns a non-empty array", () => {
    const options = getCountryOptions("en");
    expect(options.length).toBeGreaterThan(0);
  });

  it("returns objects with { value, label } shape", () => {
    const options = getCountryOptions("en");
    for (const option of options) {
      expect(option).toHaveProperty("value");
      expect(option).toHaveProperty("label");
      expect(typeof option.value).toBe("string");
      expect(typeof option.label).toBe("string");
    }
  });

  it("returns ISO 3166-1 alpha-2 codes (2 uppercase letters)", () => {
    const options = getCountryOptions("en");
    for (const option of options) {
      expect(option.value).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("includes major countries (FR, US, GB, DE)", () => {
    const options = getCountryOptions("en");
    const codes = options.map((o) => o.value);
    expect(codes).toContain("FR");
    expect(codes).toContain("US");
    expect(codes).toContain("GB");
    expect(codes).toContain("DE");
  });

  it("returns localized labels in French for locale 'fr'", () => {
    const options = getCountryOptions("fr");
    const france = options.find((o) => o.value === "FR");
    expect(france?.label).toBe("France");
    const germany = options.find((o) => o.value === "DE");
    expect(germany?.label).toBe("Allemagne");
  });

  it("returns localized labels in English for locale 'en'", () => {
    const options = getCountryOptions("en");
    const france = options.find((o) => o.value === "FR");
    expect(france?.label).toBe("France");
    const germany = options.find((o) => o.value === "DE");
    expect(germany?.label).toBe("Germany");
  });

  it("returns results sorted alphabetically by label", () => {
    const options = getCountryOptions("en");
    const labels = options.map((o) => o.label);
    const sorted = [...labels].sort((a, b) => a.localeCompare(b, "en"));
    expect(labels).toEqual(sorted);
  });

  it("sorts by localized label (Allemagne before France in French)", () => {
    const options = getCountryOptions("fr");
    const germanyIndex = options.findIndex((o) => o.value === "DE");
    const franceIndex = options.findIndex((o) => o.value === "FR");
    expect(germanyIndex).toBeLessThan(franceIndex);
  });
});
