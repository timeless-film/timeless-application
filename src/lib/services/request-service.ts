import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts, requests, films, cinemas, rooms } from "@/lib/db/schema";
import { sendRequestNotificationToRightsHolder } from "@/lib/email/request-emails";
import { calculatePricing, getPlatformPricingSettings, resolveCommissionRate } from "@/lib/pricing";
import { getAccountUserEmails } from "@/lib/services/account-users";
import { generateValidationToken } from "@/lib/services/request-token-service";

import type { requestStatusEnum } from "@/lib/db/schema";

export type RequestStatus = (typeof requestStatusEnum.enumValues)[number];

// ─── Types ────────────────────────────────────────────────────────────────────

export type RequestTransitionError =
  | "INVALID_TRANSITION"
  | "REQUEST_NOT_FOUND"
  | "UNAUTHORIZED"
  | "REQUEST_ALREADY_FINAL";

export type RequestTransitionResult =
  | { success: true; requestId: string }
  | { success: false; error: RequestTransitionError };

// ─── State machine rules (E06 spec) ───────────────────────────────────────────

const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  pending: ["approved", "rejected", "cancelled"],
  approved: ["paid"],
  rejected: [],
  cancelled: [],
  paid: [],
  // Deprecated statuses have no valid transitions
  validated: [],
  refused: [],
  expired: [],
};

const FINAL_STATUSES: RequestStatus[] = ["rejected", "cancelled", "paid", "refused", "expired"];

/**
 * Check if a status transition is valid according to E06 state machine.
 */
export function isValidTransition(fromStatus: RequestStatus, toStatus: RequestStatus): boolean {
  const allowedTargets = VALID_TRANSITIONS[fromStatus];
  return allowedTargets?.includes(toStatus) ?? false;
}

/**
 * Check if a request status is final (no further transitions allowed).
 */
export function isFinalStatus(status: RequestStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

// ─── Request transition functions ─────────────────────────────────────────────

/**
 * Transition a request from one status to another with validation.
 * Enforces state machine rules: allowed transitions, final status checks.
 */
export async function transitionRequestStatus(params: {
  requestId: string;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  exhibitorAccountId?: string; // For exhibitor-initiated transitions (cancel)
  rightsHolderAccountId?: string; // For rights holder-initiated transitions (approve/reject)
  reason?: string;
  approvalNote?: string;
  processedByUserId?: string | null;
}): Promise<RequestTransitionResult> {
  const {
    requestId,
    fromStatus,
    toStatus,
    exhibitorAccountId,
    rightsHolderAccountId,
    reason,
    approvalNote,
    processedByUserId,
  } = params;

  // Validate transition
  if (!isValidTransition(fromStatus, toStatus)) {
    return { success: false, error: "INVALID_TRANSITION" };
  }

  // Fetch request to verify current status and ownership
  const request = await db.query.requests.findFirst({
    where: eq(requests.id, requestId),
  });

  if (!request) {
    return { success: false, error: "REQUEST_NOT_FOUND" };
  }

  // Verify current status matches expected fromStatus
  if (request.status !== fromStatus) {
    return { success: false, error: "INVALID_TRANSITION" };
  }

  // Verify authorization based on transition type
  if (toStatus === "cancelled" && exhibitorAccountId) {
    if (request.exhibitorAccountId !== exhibitorAccountId) {
      return { success: false, error: "UNAUTHORIZED" };
    }
  }

  if ((toStatus === "approved" || toStatus === "rejected") && rightsHolderAccountId) {
    if (request.rightsHolderAccountId !== rightsHolderAccountId) {
      return { success: false, error: "UNAUTHORIZED" };
    }
  }

  // Apply transition with appropriate timestamp and reason fields
  const updates: Partial<typeof requests.$inferInsert> = {
    status: toStatus,
  };

  if (toStatus === "approved") {
    updates.approvedAt = new Date();
    updates.approvalNote = approvalNote ?? null;
    if (processedByUserId !== undefined) {
      updates.processedByUserId = processedByUserId;
    }
  } else if (toStatus === "rejected") {
    updates.rejectedAt = new Date();
    updates.rejectionReason = reason;
    if (processedByUserId !== undefined) {
      updates.processedByUserId = processedByUserId;
    }
  } else if (toStatus === "cancelled") {
    updates.cancelledAt = new Date();
    updates.cancellationReason = reason;
  } else if (toStatus === "paid") {
    updates.paidAt = new Date();
  }

  await db.update(requests).set(updates).where(eq(requests.id, requestId));

  return { success: true, requestId };
}

/**
 * Cancel a pending request (exhibitor action).
 */
export async function cancelRequest(params: {
  requestId: string;
  exhibitorAccountId: string;
  reason?: string;
}): Promise<RequestTransitionResult> {
  return transitionRequestStatus({
    requestId: params.requestId,
    fromStatus: "pending",
    toStatus: "cancelled",
    exhibitorAccountId: params.exhibitorAccountId,
    reason: params.reason,
  });
}

/**
 * Get requests summary for a film (used in modal to show existing requests).
 * Returns pending and approved requests for anti-duplicate awareness.
 */
export async function getRequestsSummaryForFilm(params: {
  filmId: string;
  exhibitorAccountId: string;
}): Promise<
  Array<{
    id: string;
    status: RequestStatus;
    cinemaName: string;
    roomName: string;
    screeningCount: number;
    startDate: string | null;
    endDate: string | null;
    createdAt: Date;
  }>
> {
  const result = await db.query.requests.findMany({
    where: and(
      eq(requests.filmId, params.filmId),
      eq(requests.exhibitorAccountId, params.exhibitorAccountId),
      inArray(requests.status, ["pending", "approved"])
    ),
    with: {
      cinema: true,
      room: true,
    },
    orderBy: (requests, { desc }) => [desc(requests.createdAt)],
    limit: 10,
  });

  return result.map((r) => ({
    id: r.id,
    status: r.status,
    cinemaName: r.cinema.name,
    roomName: r.room.name,
    screeningCount: r.screeningCount,
    startDate: r.startDate,
    endDate: r.endDate,
    createdAt: r.createdAt,
  }));
}

/**
 * Check if a request can be relaunched (must be cancelled or rejected).
 */
export function canRelaunchRequest(status: RequestStatus): boolean {
  return status === "cancelled" || status === "rejected";
}

// ─── Create request logic ─────────────────────────────────────────────────────

export type CreateRequestError =
  | "FILM_NOT_FOUND"
  | "INVALID_FILM_TYPE"
  | "TERRITORY_NOT_AVAILABLE"
  | "INVALID_CINEMA"
  | "INVALID_ROOM"
  | "INVALID_DATE_RANGE"
  | "DATABASE_ERROR"
  | "UNAUTHORIZED";

export type CreateRequestResult =
  | { success: true; requestId: string }
  | { success: false; error: CreateRequestError };

/**
 * Create a validation request for a film.
 * Verifies film type, territory, cinema/room ownership, calculates pricing.
 */
export async function createRequest(params: {
  exhibitorAccountId: string;
  filmId: string;
  cinemaId: string;
  roomId: string;
  screeningCount: number;
  startDate?: string;
  endDate?: string;
  note?: string;
  createdByUserId?: string;
}): Promise<CreateRequestResult> {
  const {
    exhibitorAccountId,
    filmId,
    cinemaId,
    roomId,
    screeningCount,
    startDate,
    endDate,
    note,
    createdByUserId,
  } = params;

  // 1. Date validation (same as cart)
  if (endDate && !startDate) {
    return { success: false, error: "INVALID_DATE_RANGE" };
  }

  if (startDate && endDate && endDate < startDate) {
    return { success: false, error: "INVALID_DATE_RANGE" };
  }

  // J+1 check for startDate
  if (startDate) {
    const tomorrow = new Date();
    tomorrow.setUTCHours(0, 0, 0, 0);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    if (new Date(startDate) < tomorrow) {
      return { success: false, error: "INVALID_DATE_RANGE" };
    }
  }

  // 2. Verify film exists and is type "validation"
  const film = await db.query.films.findFirst({
    where: eq(films.id, filmId),
    with: {
      prices: true,
      account: true,
    },
  });

  if (!film || film.status !== "active") {
    return { success: false, error: "FILM_NOT_FOUND" };
  }

  if (film.type !== "validation") {
    return { success: false, error: "INVALID_FILM_TYPE" };
  }

  // 3. Verify cinema belongs to exhibitor
  const cinema = await db.query.cinemas.findFirst({
    where: and(eq(cinemas.id, cinemaId), eq(cinemas.accountId, exhibitorAccountId)),
  });

  if (!cinema) {
    return { success: false, error: "INVALID_CINEMA" };
  }

  // 4. Verify room belongs to cinema
  const room = await db.query.rooms.findFirst({
    where: and(eq(rooms.id, roomId), eq(rooms.cinemaId, cinemaId)),
  });

  if (!room) {
    return { success: false, error: "INVALID_ROOM" };
  }

  // 5. Verify film is available in cinema's territory
  const hasMatchingPrice = film.prices.some((priceZone) =>
    priceZone.countries.includes(cinema.country)
  );

  if (!hasMatchingPrice) {
    return { success: false, error: "TERRITORY_NOT_AVAILABLE" };
  }

  // 6. Calculate pricing and insert request
  try {
    const settings = await getPlatformPricingSettings();
    const commissionRate = resolveCommissionRate(
      film.account.commissionRate,
      settings.defaultCommissionRate
    );

    const matchingPrice =
      film.prices.find((priceZone) => priceZone.countries.includes(cinema.country)) ??
      film.prices[0];

    if (!matchingPrice) {
      return { success: false, error: "TERRITORY_NOT_AVAILABLE" };
    }

    const pricing = calculatePricing({
      catalogPrice: matchingPrice.price,
      currency: matchingPrice.currency,
      platformMarginRate: settings.platformMarginRate,
      deliveryFees: settings.deliveryFees,
      commissionRate,
    });

    const [inserted] = await db
      .insert(requests)
      .values({
        exhibitorAccountId,
        rightsHolderAccountId: film.accountId,
        filmId,
        cinemaId,
        roomId,
        screeningCount,
        startDate: startDate || null,
        endDate: endDate || null,
        note: note || null,
        createdByUserId: createdByUserId ?? null,
        catalogPrice: pricing.catalogPrice,
        currency: pricing.currency,
        platformMarginRate: pricing.platformMarginRate.toString(),
        deliveryFees: pricing.deliveryFees,
        commissionRate: pricing.commissionRate.toString(),
        displayedPrice: pricing.displayedPrice,
        rightsHolderAmount: pricing.rightsHolderAmount,
        timelessAmount: pricing.timelessAmount,
        status: "pending",
      })
      .returning({ id: requests.id });

    const requestId = inserted!.id;

    // Generate validation token and send emails to all RH account users (fire-and-forget)
    sendValidationEmails({
      requestId,
      rightsHolderAccountId: film.accountId,
      exhibitorAccountId,
      filmTitle: film.title,
      cinemaName: cinema.name,
      cinemaAddress: cinema.address,
      cinemaCity: cinema.city,
      cinemaPostalCode: cinema.postalCode,
      cinemaCountry: cinema.country,
      roomName: room.name,
      roomCapacity: room.capacity,
      screeningCount,
      startDate: startDate || null,
      endDate: endDate || null,
      displayedPrice: pricing.displayedPrice,
      rightsHolderAmount: pricing.rightsHolderAmount,
      currency: pricing.currency,
      note: note || null,
    }).catch((err) => {
      console.error("Failed to send validation emails:", err);
    });

    return { success: true, requestId };
  } catch (error) {
    console.error("Failed to create request:", error);
    return { success: false, error: "DATABASE_ERROR" };
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Generate validation tokens and send notification emails to all RH account users.
 * Fire-and-forget — errors are logged but don't affect the request creation.
 */
async function sendValidationEmails(params: {
  requestId: string;
  rightsHolderAccountId: string;
  exhibitorAccountId: string;
  filmTitle: string;
  cinemaName: string;
  cinemaAddress: string | null;
  cinemaCity: string | null;
  cinemaPostalCode: string | null;
  cinemaCountry: string;
  roomName: string;
  roomCapacity: number;
  screeningCount: number;
  startDate: string | null;
  endDate: string | null;
  displayedPrice: number;
  rightsHolderAmount: number;
  currency: string;
  note: string | null;
}): Promise<void> {
  // Get exhibitor account details
  const exhibitorAccount = await db.query.accounts.findFirst({
    where: eq(accounts.id, params.exhibitorAccountId),
    columns: {
      companyName: true,
      country: true,
      vatNumber: true,
    },
  });

  if (!exhibitorAccount) {
    console.error("sendValidationEmails: exhibitor account not found");
    return;
  }

  // Get all RH account users
  const rhUsers = await getAccountUserEmails(params.rightsHolderAccountId);
  if (rhUsers.length === 0) {
    console.warn("sendValidationEmails: no users found for RH account");
    return;
  }

  // Generate a token per user (each token includes the user's ID for traceability)
  for (const user of rhUsers) {
    const token = await generateValidationToken(params.requestId, user.userId);

    // Store token on the request (last one wins — all tokens are valid independently)
    await db
      .update(requests)
      .set({ validationToken: token, updatedAt: new Date() })
      .where(eq(requests.id, params.requestId));

    await sendRequestNotificationToRightsHolder({
      requestId: params.requestId,
      token,
      filmTitle: params.filmTitle,
      exhibitorCompanyName: exhibitorAccount.companyName,
      exhibitorCountry: exhibitorAccount.country,
      exhibitorVatNumber: exhibitorAccount.vatNumber,
      cinemaName: params.cinemaName,
      cinemaAddress: params.cinemaAddress,
      cinemaCity: params.cinemaCity,
      cinemaPostalCode: params.cinemaPostalCode,
      cinemaCountry: params.cinemaCountry,
      roomName: params.roomName,
      roomCapacity: params.roomCapacity,
      screeningCount: params.screeningCount,
      startDate: params.startDate,
      endDate: params.endDate,
      displayedPrice: params.displayedPrice,
      rightsHolderAmount: params.rightsHolderAmount,
      currency: params.currency,
      note: params.note,
      recipientEmail: user.email,
      recipientName: user.name,
      recipientLocale: user.preferredLocale,
    });
  }
}
