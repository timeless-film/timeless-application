import { describe, expect, it } from "vitest";

import {
  EU_COUNTRY_CODES,
  extractVatCountryCode,
  normalizeVatNumber,
  validateVatFormat,
} from "../vat-service";

// ─── normalizeVatNumber ───────────────────────────────────────────────────────

describe("normalizeVatNumber", () => {
  it("removes spaces, dots, and dashes", () => {
    expect(normalizeVatNumber("FR 12 345 678 901")).toBe("FR12345678901");
    expect(normalizeVatNumber("DE-123.456.789")).toBe("DE123456789");
  });

  it("converts to uppercase", () => {
    expect(normalizeVatNumber("fr12345678901")).toBe("FR12345678901");
    expect(normalizeVatNumber("ie1234567ab")).toBe("IE1234567AB");
  });

  it("handles already normalized input", () => {
    expect(normalizeVatNumber("FR12345678901")).toBe("FR12345678901");
  });
});

// ─── extractVatCountryCode ────────────────────────────────────────────────────

describe("extractVatCountryCode", () => {
  it("extracts FR from a French VAT number", () => {
    expect(extractVatCountryCode("FR12345678901")).toBe("FR");
  });

  it("extracts DE from a German VAT number", () => {
    expect(extractVatCountryCode("DE123456789")).toBe("DE");
  });

  it("maps Greek EL prefix to GR country code", () => {
    expect(extractVatCountryCode("EL123456789")).toBe("GR");
  });

  it("returns null for non-EU prefixes", () => {
    expect(extractVatCountryCode("US123456789")).toBeNull();
    expect(extractVatCountryCode("XX123456789")).toBeNull();
  });

  it("returns null for too-short input", () => {
    expect(extractVatCountryCode("F")).toBeNull();
    expect(extractVatCountryCode("")).toBeNull();
  });

  it("normalizes input before extracting", () => {
    expect(extractVatCountryCode("fr 12 345 678 901")).toBe("FR");
  });
});

// ─── validateVatFormat ────────────────────────────────────────────────────────

describe("validateVatFormat", () => {
  // Valid formats per country

  it("validates French VAT numbers (FRXX999999999)", () => {
    expect(validateVatFormat("FR12345678901")).toEqual({ valid: true });
    expect(validateVatFormat("FRAB123456789")).toEqual({ valid: true });
    // I and O are excluded from the pattern
    expect(validateVatFormat("FRI1123456789")).toEqual({
      valid: false,
      reason: "INVALID_FORMAT",
    });
  });

  it("validates German VAT numbers (DE999999999)", () => {
    expect(validateVatFormat("DE123456789")).toEqual({ valid: true });
    expect(validateVatFormat("DE12345678")).toEqual({
      valid: false,
      reason: "INVALID_FORMAT",
    });
    expect(validateVatFormat("DE1234567890")).toEqual({
      valid: false,
      reason: "INVALID_FORMAT",
    });
  });

  it("validates Belgian VAT numbers (BE0999999999)", () => {
    expect(validateVatFormat("BE0123456789")).toEqual({ valid: true });
    expect(validateVatFormat("BE1123456789")).toEqual({ valid: true });
    expect(validateVatFormat("BE2123456789")).toEqual({
      valid: false,
      reason: "INVALID_FORMAT",
    });
  });

  it("validates Italian VAT numbers (IT99999999999)", () => {
    expect(validateVatFormat("IT12345678901")).toEqual({ valid: true });
    expect(validateVatFormat("IT1234567890")).toEqual({
      valid: false,
      reason: "INVALID_FORMAT",
    });
  });

  it("validates Spanish VAT numbers (ESX9999999X)", () => {
    expect(validateVatFormat("ESA12345678")).toEqual({ valid: true });
    expect(validateVatFormat("ES12345678A")).toEqual({ valid: true });
    expect(validateVatFormat("ESA1234567B")).toEqual({ valid: true });
  });

  it("validates Dutch VAT numbers (NL999999999B99)", () => {
    expect(validateVatFormat("NL123456789B01")).toEqual({ valid: true });
    expect(validateVatFormat("NL123456789A01")).toEqual({
      valid: false,
      reason: "INVALID_FORMAT",
    });
  });

  it("validates Austrian VAT numbers (ATU99999999)", () => {
    expect(validateVatFormat("ATU12345678")).toEqual({ valid: true });
    expect(validateVatFormat("AT12345678")).toEqual({
      valid: false,
      reason: "INVALID_FORMAT",
    });
  });

  it("validates Polish VAT numbers (PL9999999999)", () => {
    expect(validateVatFormat("PL1234567890")).toEqual({ valid: true });
  });

  it("validates Swedish VAT numbers (SE999999999999)", () => {
    expect(validateVatFormat("SE123456789012")).toEqual({ valid: true });
  });

  it("validates Northern Ireland VAT numbers (XI999999999)", () => {
    expect(validateVatFormat("XI123456789")).toEqual({ valid: true });
  });

  // Invalid formats

  it("returns INVALID_FORMAT for wrong digit count", () => {
    expect(validateVatFormat("FR1234")).toEqual({
      valid: false,
      reason: "INVALID_FORMAT",
    });
  });

  it("returns UNKNOWN_COUNTRY for non-EU prefixes", () => {
    expect(validateVatFormat("US123456789")).toEqual({
      valid: false,
      reason: "UNKNOWN_COUNTRY",
    });
    expect(validateVatFormat("GB123456789")).toEqual({
      valid: false,
      reason: "UNKNOWN_COUNTRY",
    });
  });

  it("returns INVALID_FORMAT for empty/short strings", () => {
    expect(validateVatFormat("")).toEqual({
      valid: false,
      reason: "INVALID_FORMAT",
    });
    expect(validateVatFormat("F")).toEqual({
      valid: false,
      reason: "INVALID_FORMAT",
    });
  });

  it("handles whitespace and formatting in input", () => {
    expect(validateVatFormat("FR 12 345 678 901")).toEqual({ valid: true });
    expect(validateVatFormat("DE-123-456-789")).toEqual({ valid: true });
  });
});

// ─── EU_COUNTRY_CODES ─────────────────────────────────────────────────────────

describe("EU_COUNTRY_CODES", () => {
  it("contains all 27 EU member states plus XI", () => {
    // 27 EU members + XI (Northern Ireland)
    expect(EU_COUNTRY_CODES.length).toBe(28);
  });

  it("includes key EU countries", () => {
    expect(EU_COUNTRY_CODES).toContain("FR");
    expect(EU_COUNTRY_CODES).toContain("DE");
    expect(EU_COUNTRY_CODES).toContain("IT");
    expect(EU_COUNTRY_CODES).toContain("ES");
    expect(EU_COUNTRY_CODES).toContain("NL");
    expect(EU_COUNTRY_CODES).toContain("BE");
  });

  it("uses EL for Greece (not GR)", () => {
    expect(EU_COUNTRY_CODES).toContain("EL");
    expect(EU_COUNTRY_CODES).not.toContain("GR");
  });
});
