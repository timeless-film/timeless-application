/**
 * Exchange Rate Service (Frankfurter API)
 *
 * Provides currency conversion with 1-hour cache and EUR fallback.
 * Uses Frankfurter.app (free, no API key required, ECB data).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExchangeRates {
  base: string; // Base currency (always EUR from Frankfurter)
  date: string; // Rate date (YYYY-MM-DD)
  rates: Record<string, number>; // Currency code → rate
  cachedAt: Date; // Timestamp of cache
}

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

let cachedRates: ExchangeRates | null = null;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

function isCacheValid(): boolean {
  if (!cachedRates) return false;
  const age = Date.now() - cachedRates.cachedAt.getTime();
  return age < CACHE_DURATION_MS;
}

// ─── Frankfurter API ──────────────────────────────────────────────────────────

const FRANKFURTER_BASE_URL = "https://api.frankfurter.app";
const FETCH_TIMEOUT_MS = 5000; // 5 seconds

async function fetchRatesFromFrankfurter(): Promise<ExchangeRates | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(`${FRANKFURTER_BASE_URL}/latest`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Frankfurter API error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as FrankfurterResponse;

    return {
      base: data.base,
      date: data.date,
      rates: data.rates,
      cachedAt: new Date(),
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.error("Frankfurter API timeout");
      } else {
        console.error("Frankfurter API fetch error:", error.message);
      }
    }
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get current exchange rates (cached for 1 hour).
 * Returns null if API is unavailable.
 */
export async function getExchangeRates(): Promise<ExchangeRates | null> {
  // Return cached rates if still valid
  if (isCacheValid()) {
    return cachedRates;
  }

  // Fetch fresh rates
  const freshRates = await fetchRatesFromFrankfurter();
  if (freshRates) {
    cachedRates = freshRates;
  }

  return cachedRates;
}

/**
 * Convert amount from one currency to another.
 *
 * @param amount - Amount in cents (integer)
 * @param from - Source currency code (ISO 4217)
 * @param to - Target currency code (ISO 4217)
 * @returns Converted amount in cents, or null if conversion fails
 *
 * @example
 * const usdAmount = await convertCurrency(10000, "EUR", "USD"); // 10 EUR → ~11 USD
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<number | null> {
  // Same currency — no conversion needed
  if (from === to) {
    return amount;
  }

  const rates = await getExchangeRates();
  if (!rates) {
    console.warn("Exchange rates unavailable — returning null");
    return null;
  }

  // Frankfurter base is always EUR
  const fromRate = from === "EUR" ? 1 : rates.rates[from];
  const toRate = to === "EUR" ? 1 : rates.rates[to];

  if (!fromRate || !toRate) {
    console.error(`Currency conversion failed: ${from} → ${to} (rates missing)`);
    return null;
  }

  // Convert: amount (in cents) → EUR → target currency
  const amountInEur = amount / fromRate;
  const convertedAmount = Math.round(amountInEur * toRate);

  return convertedAmount;
}

/**
 * Convert amount with fallback to original value (for display purposes).
 * Returns original amount if conversion fails.
 */
export async function convertCurrencyWithFallback(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  const converted = await convertCurrency(amount, from, to);
  return converted ?? amount;
}

/**
 * Format amount with indicative conversion.
 *
 * @example
 * formatWithConversion(15000, "EUR", "USD") → "150.00 EUR (~162.00 USD as of 2024-03-15)"
 */
export async function formatWithConversion(
  amount: number,
  nativeCurrency: string,
  preferredCurrency: string
): Promise<string> {
  const nativeFormatted = `${(amount / 100).toFixed(2)} ${nativeCurrency}`;

  if (nativeCurrency === preferredCurrency) {
    return nativeFormatted;
  }

  const converted = await convertCurrency(amount, nativeCurrency, preferredCurrency);
  if (!converted) {
    return nativeFormatted; // Fallback if conversion fails
  }

  const rates = await getExchangeRates();
  const rateDate = rates?.date || "unknown";

  return `${nativeFormatted} (~${(converted / 100).toFixed(2)} ${preferredCurrency} as of ${rateDate})`;
}

/**
 * Clear cached rates (for testing).
 */
export function clearRatesCache(): void {
  cachedRates = null;
}
