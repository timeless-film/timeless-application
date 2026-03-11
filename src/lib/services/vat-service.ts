/**
 * VAT number validation service.
 *
 * - Format validation: regex per EU country (structural check only)
 * - Stripe sync: handled by getOrUpdateStripeCustomer() in stripe/index.ts
 */

// ─── EU VAT format patterns ──────────────────────────────────────────────────

/**
 * Regex patterns for EU VAT numbers, keyed by 2-letter ISO country code.
 * Source: https://ec.europa.eu/taxation_customs/vies/faq.html
 */
const EU_VAT_PATTERNS: Record<string, RegExp> = {
  AT: /^ATU\d{8}$/,
  BE: /^BE[01]\d{9}$/,
  BG: /^BG\d{9,10}$/,
  CY: /^CY\d{8}[A-Z]$/,
  CZ: /^CZ\d{8,10}$/,
  DE: /^DE\d{9}$/,
  DK: /^DK\d{8}$/,
  EE: /^EE\d{9}$/,
  EL: /^EL\d{9}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^FI\d{8}$/,
  FR: /^FR[A-HJ-NP-Z0-9]{2}\d{9}$/,
  HR: /^HR\d{11}$/,
  HU: /^HU\d{8}$/,
  IE: /^IE(\d{7}[A-Z]{1,2}|\d[A-Z+*]\d{5}[A-Z])$/,
  IT: /^IT\d{11}$/,
  LT: /^LT(\d{9}|\d{12})$/,
  LU: /^LU\d{8}$/,
  LV: /^LV\d{11}$/,
  MT: /^MT\d{8}$/,
  NL: /^NL\d{9}B\d{2}$/,
  PL: /^PL\d{10}$/,
  PT: /^PT\d{9}$/,
  RO: /^RO\d{2,10}$/,
  SE: /^SE\d{12}$/,
  SI: /^SI\d{8}$/,
  SK: /^SK\d{10}$/,
  // Northern Ireland uses XI prefix post-Brexit
  XI: /^XI\d{9}$/,
};

/**
 * All EU country codes that have VAT number patterns.
 */
export const EU_COUNTRY_CODES = Object.keys(EU_VAT_PATTERNS);

/**
 * Extracts the 2-letter country prefix from a VAT number.
 * Returns null if the VAT number doesn't start with a valid EU country prefix.
 *
 * Special case: Greece uses "EL" as VAT prefix but "GR" as ISO country code.
 */
export function extractVatCountryCode(vatNumber: string): string | null {
  const normalized = vatNumber.replace(/[\s.-]/g, "").toUpperCase();
  if (normalized.length < 2) return null;

  // Try 2-letter prefix first
  const prefix = normalized.substring(0, 2);

  if (prefix in EU_VAT_PATTERNS) {
    // Map EL → GR for ISO country code
    return prefix === "EL" ? "GR" : prefix;
  }

  return null;
}

/**
 * Validates the format of a VAT number against EU country-specific patterns.
 * Does NOT check if the number is actually registered — use validateVatVies() for that.
 *
 * Returns { valid: true } or { valid: false, reason: "INVALID_FORMAT" | "UNKNOWN_COUNTRY" }
 */
export function validateVatFormat(vatNumber: string): {
  valid: boolean;
  reason?: "INVALID_FORMAT" | "UNKNOWN_COUNTRY";
} {
  const normalized = vatNumber.replace(/[\s.-]/g, "").toUpperCase();
  if (normalized.length < 2) return { valid: false, reason: "INVALID_FORMAT" };

  const prefix = normalized.substring(0, 2);
  const pattern = EU_VAT_PATTERNS[prefix];

  if (!pattern) {
    return { valid: false, reason: "UNKNOWN_COUNTRY" };
  }

  if (!pattern.test(normalized)) {
    return { valid: false, reason: "INVALID_FORMAT" };
  }

  return { valid: true };
}

/**
 * Normalizes a VAT number by removing whitespace, dots, and dashes, and uppercasing.
 */
export function normalizeVatNumber(vatNumber: string): string {
  return vatNumber.replace(/[\s.-]/g, "").toUpperCase();
}
