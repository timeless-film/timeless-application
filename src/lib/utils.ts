import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Délai en ms avant expiration d'une demande */
export function calculateRequestExpiry(
  startDate: Date,
  expirationDays: number,
  urgencyDaysBeforeStart: number
): Date {
  const standardExpiry = new Date();
  standardExpiry.setDate(standardExpiry.getDate() + expirationDays);

  const urgencyExpiry = new Date(startDate);
  urgencyExpiry.setDate(urgencyExpiry.getDate() - urgencyDaysBeforeStart);

  // Retourne la date la plus proche
  return urgencyExpiry < standardExpiry ? urgencyExpiry : standardExpiry;
}

/** Vérifie si une demande est expirée */
export function isRequestExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/** Retourne le prix d'un film pour un pays donné */
export function findPriceForCountry(
  prices: { countries: string[]; price: number; currency: string }[],
  country: string
) {
  return prices.find((p) => p.countries.includes(country.toUpperCase())) ?? null;
}
