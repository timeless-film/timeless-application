"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getPublishedDocument, recordAcceptance } from "@/lib/services/legal-service";

/**
 * Server action for accepting the current CGU from the interstitial page.
 */
export async function acceptTermsOfService() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  const document = await getPublishedDocument("terms_of_service");
  if (!document) return { error: "DOCUMENT_NOT_FOUND" as const };

  try {
    await recordAcceptance({
      documentId: document.id,
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
    });

    return { success: true as const };
  } catch (error) {
    console.error("Failed to accept terms of service:", error);
    return { error: "ACCEPTANCE_FAILED" as const };
  }
}

/**
 * Server action for accepting the current CGV from the interstitial page.
 */
export async function acceptTermsOfSale(accountId: string, country: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  const document = await getPublishedDocument("terms_of_sale", country);
  if (!document) return { error: "DOCUMENT_NOT_FOUND" as const };

  try {
    await recordAcceptance({
      documentId: document.id,
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      accountId,
    });

    return { success: true as const };
  } catch (error) {
    console.error("Failed to accept terms of sale:", error);
    return { error: "ACCEPTANCE_FAILED" as const };
  }
}
