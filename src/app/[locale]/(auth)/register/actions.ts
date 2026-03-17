"use server";

import { getPublishedDocument, recordAcceptance } from "@/lib/services/legal-service";

interface RecordRegistrationAcceptanceInput {
  userId: string;
  userName: string;
  userEmail: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Records CGU + Privacy Policy acceptance at registration.
 * Called after successful signUp.email() on the client.
 * Best-effort: registration is not blocked if acceptance recording fails.
 */
export async function recordRegistrationAcceptance(input: RecordRegistrationAcceptanceInput) {
  try {
    const [cgu, privacy] = await Promise.all([
      getPublishedDocument("terms_of_service"),
      getPublishedDocument("privacy_policy"),
    ]);

    const acceptancePromises: Promise<unknown>[] = [];

    if (cgu) {
      acceptancePromises.push(
        recordAcceptance({
          documentId: cgu.id,
          userId: input.userId,
          userName: input.userName,
          userEmail: input.userEmail,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        })
      );
    }

    if (privacy) {
      acceptancePromises.push(
        recordAcceptance({
          documentId: privacy.id,
          userId: input.userId,
          userName: input.userName,
          userEmail: input.userEmail,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        })
      );
    }

    await Promise.all(acceptancePromises);

    return { success: true as const };
  } catch (error) {
    console.error("Failed to record registration acceptance:", error);
    return { error: "ACCEPTANCE_RECORDING_FAILED" as const };
  }
}
