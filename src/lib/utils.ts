import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Delay in ms before a request expires */
export function calculateRequestExpiry(
  startDate: Date,
  expirationDays: number,
  urgencyDaysBeforeStart: number
): Date {
  const standardExpiry = new Date();
  standardExpiry.setDate(standardExpiry.getDate() + expirationDays);

  const urgencyExpiry = new Date(startDate);
  urgencyExpiry.setDate(urgencyExpiry.getDate() - urgencyDaysBeforeStart);

  // Return the earliest date
  return urgencyExpiry < standardExpiry ? urgencyExpiry : standardExpiry;
}

/** Checks whether a request has expired */
export function isRequestExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/** Returns the price of a film for a given country */
export function findPriceForCountry(
  prices: { countries: string[]; price: number; currency: string }[],
  country: string
) {
  return prices.find((p) => p.countries.includes(country.toUpperCase())) ?? null;
}
