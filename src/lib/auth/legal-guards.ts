import { redirect } from "next/navigation";

import {
  getPublishedDocument,
  hasUserAcceptedCurrentTerms,
  hasAccountAcceptedCurrentTermsOfSale,
} from "@/lib/services/legal-service";

/**
 * Server-side guard: redirects to /accept-terms if the user hasn't accepted the latest CGU.
 * Call in authenticated layouts to enforce CGU acceptance.
 */
export async function requireTermsAcceptance(userId: string, locale: string): Promise<void> {
  const publishedCgu = await getPublishedDocument("terms_of_service");
  if (!publishedCgu) return; // No published CGU → nothing to accept

  const acceptance = await hasUserAcceptedCurrentTerms(userId);
  if (acceptance) return; // Already accepted

  redirect(`/${locale}/accept-terms`);
}

/**
 * Server-side guard: redirects to /accept-terms/sale if the account hasn't accepted the latest CGV.
 * Call in authenticated layouts after account is resolved.
 */
export async function requireTermsOfSaleAcceptance(
  accountId: string,
  country: string,
  locale: string
): Promise<void> {
  const publishedCgv = await getPublishedDocument("terms_of_sale", country);
  if (!publishedCgv) return; // No published CGV → nothing to accept

  const acceptance = await hasAccountAcceptedCurrentTermsOfSale(accountId, country);
  if (acceptance) return; // Already accepted

  redirect(`/${locale}/accept-terms/sale`);
}
