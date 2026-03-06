import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";

export interface PricingParams {
  cataloguePrice: number;     // En centimes
  currency: string;
  platformMarginRate: number; // Ex: 0.20 pour 20%
  deliveryFees: number;       // En centimes
  commissionRate: number;     // Ex: 0.10 pour 10%
}

export interface PricingResult {
  cataloguePrice: number;
  platformMarginRate: number;
  deliveryFees: number;
  commissionRate: number;
  displayedPrice: number;    // Ce que voit l'exploitant (HT)
  ayantDroitAmount: number;  // Ce que reçoit l'ayant droit
  timelessAmount: number;    // Ce que garde TIMELESS
  currency: string;
}

/**
 * Calcule le prix affiché et la répartition pour une ligne de commande.
 *
 * Formule :
 *   displayedPrice = cataloguePrice × (1 + marginRate) + deliveryFees
 *   ayantDroitAmount = cataloguePrice × (1 - commissionRate)
 *   timelessAmount = displayedPrice - ayantDroitAmount
 */
export function calculatePricing(params: PricingParams): PricingResult {
  const { cataloguePrice, platformMarginRate, deliveryFees, commissionRate, currency } = params;

  const displayedPrice = Math.round(cataloguePrice * (1 + platformMarginRate) + deliveryFees);
  const ayantDroitAmount = Math.round(cataloguePrice * (1 - commissionRate));
  const timelessAmount = displayedPrice - ayantDroitAmount;

  return {
    cataloguePrice,
    platformMarginRate,
    deliveryFees,
    commissionRate,
    displayedPrice,
    ayantDroitAmount,
    timelessAmount,
    currency,
  };
}

/**
 * Récupère les paramètres de tarification actuels depuis la DB.
 * À utiliser côté serveur uniquement.
 */
export async function getPlatformPricingSettings() {
  const settings = await db.query.platformSettings.findFirst({
    where: (s, { eq }) => eq(s.id, "global"),
  });

  if (!settings) {
    throw new Error("Platform settings not found");
  }

  return {
    platformMarginRate: parseFloat(settings.platformMarginRate),
    deliveryFees: settings.deliveryFees,
    defaultCommissionRate: parseFloat(settings.defaultCommissionRate),
    requestExpirationDays: settings.requestExpirationDays,
    requestUrgencyDaysBeforeStart: settings.requestUrgencyDaysBeforeStart,
    opsEmail: settings.opsEmail,
  };
}

/**
 * Retourne le taux de commission pour un ayant droit donné.
 * Utilise le taux spécifique s'il est défini, sinon le taux global.
 */
export function resolveCommissionRate(
  ayantDroitCommissionRate: string | null | undefined,
  defaultRate: number
): number {
  if (ayantDroitCommissionRate) {
    return parseFloat(ayantDroitCommissionRate);
  }
  return defaultRate;
}

/**
 * Formate un montant en centimes vers une chaîne affichable.
 * Ex: 15000, "EUR" → "150,00 €"
 */
export function formatAmount(amountInCents: number, currency: string, locale = "fr-FR"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100);
}
