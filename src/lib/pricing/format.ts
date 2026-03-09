/**
 * Formats an amount in cents to a displayable string.
 * Pure function with no side effects.
 * Safe to use in client components.
 *
 * e.g. 15000, "EUR" → "€150.00"
 */
export function formatAmount(amountInCents: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100);
}
