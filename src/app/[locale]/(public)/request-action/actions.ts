"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requests } from "@/lib/db/schema";
import { sendExhibitorRequestNotification } from "@/lib/services/booking-service";
import { transitionRequestStatus } from "@/lib/services/request-service";
import { verifyValidationToken } from "@/lib/services/request-token-service";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const processRequestActionSchema = z.object({
  token: z.string().min(1),
  action: z.enum(["approve", "reject"]),
  note: z.string().max(1000).optional(),
});

// ─── Load request data for display ────────────────────────────────────────────

export async function loadRequestFromToken(token: string) {
  const tokenResult = await verifyValidationToken(token);
  if ("error" in tokenResult) {
    return { error: tokenResult.error };
  }

  const request = await db.query.requests.findFirst({
    where: eq(requests.id, tokenResult.requestId),
    with: {
      film: { columns: { id: true, title: true, posterUrl: true } },
      exhibitorAccount: {
        columns: { id: true, companyName: true, country: true, vatNumber: true },
      },
      cinema: {
        columns: {
          id: true,
          name: true,
          address: true,
          city: true,
          postalCode: true,
          country: true,
        },
      },
      room: { columns: { id: true, name: true, capacity: true } },
    },
  });

  if (!request) {
    return { error: "REQUEST_NOT_FOUND" as const };
  }

  if (request.status !== "pending") {
    return { error: `ALREADY_${request.status.toUpperCase()}` as const, status: request.status };
  }

  return {
    success: true as const,
    data: {
      id: request.id,
      status: request.status,
      screeningCount: request.screeningCount,
      startDate: request.startDate,
      endDate: request.endDate,
      displayedPrice: request.displayedPrice,
      rightsHolderAmount: request.rightsHolderAmount,
      currency: request.currency,
      note: request.note,
      film: request.film,
      exhibitorAccount: request.exhibitorAccount,
      cinema: request.cinema,
      room: request.room,
    },
  };
}

// ─── Process request action (approve/reject) ─────────────────────────────────

export async function processRequestAction(input: z.infer<typeof processRequestActionSchema>) {
  const parsed = processRequestActionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "INVALID_INPUT" as const };
  }

  const { token, action, note } = parsed.data;

  // 1. Verify token
  const tokenResult = await verifyValidationToken(token);
  if ("error" in tokenResult) {
    return { error: tokenResult.error };
  }

  // 2. Load request to verify status
  const request = await db.query.requests.findFirst({
    where: eq(requests.id, tokenResult.requestId),
  });

  if (!request) {
    return { error: "REQUEST_NOT_FOUND" as const };
  }

  if (request.status !== "pending") {
    return { error: `ALREADY_${request.status.toUpperCase()}` as const };
  }

  // 3. Determine processedByUserId: session > token > null
  let processedByUserId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id) {
      processedByUserId = session.user.id;
    } else {
      processedByUserId = tokenResult.userId;
    }
  } catch {
    processedByUserId = tokenResult.userId;
  }

  // 4. Apply transition
  const toStatus = action === "approve" ? "approved" : "rejected";
  const result = await transitionRequestStatus({
    requestId: request.id,
    fromStatus: "pending",
    toStatus,
    rightsHolderAccountId: request.rightsHolderAccountId,
    approvalNote: action === "approve" ? note : undefined,
    reason: action === "reject" ? note : undefined,
    processedByUserId,
  });

  if (!result.success) {
    return { error: result.error };
  }

  // 5. Send notification emails to exhibitor (fire-and-forget)
  sendExhibitorRequestNotification({
    requestId: request.id,
    action,
    note,
  }).catch((err) => {
    console.error("Failed to send exhibitor notification:", err);
  });

  return { success: true as const };
}
