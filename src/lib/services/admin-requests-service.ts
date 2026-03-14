import { and, count, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts, auditLogs, cinemas, films, requests, rooms } from "@/lib/db/schema";
import { transitionRequestStatus } from "@/lib/services/request-service";

import type { RequestStatus } from "@/lib/services/request-service";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminRequestRow {
  id: string;
  filmId: string;
  exhibitorAccountId: string;
  exhibitorName: string;
  rightsHolderAccountId: string;
  rightsHolderName: string;
  filmTitle: string;
  filmPosterUrl: string | null;
  cinemaName: string;
  startDate: string | null;
  endDate: string | null;
  status: RequestStatus;
  displayedPrice: number;
  currency: string;
  createdAt: Date;
  isUrgent: boolean;
}

interface ListRequestsOptions {
  page: number;
  limit: number;
  search?: string;
  status?: RequestStatus;
}

// ─── List requests for admin ──────────────────────────────────────────────────

export async function listRequestsForAdmin(options: ListRequestsOptions, urgencyDays: number) {
  const { page, limit, search, status } = options;
  const offset = (page - 1) * limit;

  // Build conditions
  const conditions: ReturnType<typeof eq>[] = [];
  if (status) {
    conditions.push(eq(requests.status, status));
  }
  if (search?.trim()) {
    // Search by film title, exhibitor name, or cinema name
    const searchTerm = `%${search.trim()}%`;
    conditions.push(
      sql`(
        EXISTS (SELECT 1 FROM ${films} WHERE ${films.id} = ${requests.filmId} AND ${films.title} ILIKE ${searchTerm})
        OR EXISTS (SELECT 1 FROM ${cinemas} WHERE ${cinemas.id} = ${requests.cinemaId} AND ${cinemas.name} ILIKE ${searchTerm})
        OR EXISTS (SELECT 1 FROM ${accounts} WHERE ${accounts.id} = ${requests.exhibitorAccountId} AND ${accounts.companyName} ILIKE ${searchTerm})
      )`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const urgencyThreshold = sql<boolean>`(
    ${requests.startDate} IS NOT NULL
    AND ${requests.startDate}::date - CURRENT_DATE <= ${urgencyDays}
    AND ${requests.status} NOT IN ('paid', 'rejected', 'cancelled')
  )`;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: requests.id,
        filmId: requests.filmId,
        exhibitorAccountId: requests.exhibitorAccountId,
        exhibitorName: sql<string>`(SELECT company_name FROM accounts WHERE id = ${requests.exhibitorAccountId})`,
        rightsHolderAccountId: requests.rightsHolderAccountId,
        rightsHolderName: sql<string>`(SELECT company_name FROM accounts WHERE id = ${requests.rightsHolderAccountId})`,
        filmTitle: sql<string>`(SELECT title FROM ${films} WHERE id = ${requests.filmId})`,
        filmPosterUrl: sql<
          string | null
        >`(SELECT poster_url FROM ${films} WHERE id = ${requests.filmId})`,
        cinemaName: sql<string>`(SELECT name FROM ${cinemas} WHERE id = ${requests.cinemaId})`,
        startDate: requests.startDate,
        endDate: requests.endDate,
        status: requests.status,
        displayedPrice: requests.displayedPrice,
        currency: requests.currency,
        createdAt: requests.createdAt,
        isUrgent: urgencyThreshold,
      })
      .from(requests)
      .where(whereClause)
      .orderBy(sql`${requests.createdAt} DESC`)
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(requests).where(whereClause),
  ]);

  return {
    requests: rows as AdminRequestRow[],
    total: totalResult[0]?.count ?? 0,
  };
}

// ─── Admin force approve ──────────────────────────────────────────────────────

export async function forceApproveRequest(requestId: string, adminUserId: string) {
  const result = await transitionRequestStatus({
    requestId,
    fromStatus: "pending",
    toStatus: "approved",
    processedByUserId: adminUserId,
  });

  if (!result.success) {
    return { error: result.error };
  }

  await db.insert(auditLogs).values({
    action: "request.force_approved",
    entityType: "request",
    entityId: requestId,
    performedById: adminUserId,
  });

  return { success: true as const };
}

// ─── Admin force reject ───────────────────────────────────────────────────────

export async function forceRejectRequest(requestId: string, adminUserId: string, reason?: string) {
  const result = await transitionRequestStatus({
    requestId,
    fromStatus: "pending",
    toStatus: "rejected",
    processedByUserId: adminUserId,
    reason,
  });

  if (!result.success) {
    return { error: result.error };
  }

  await db.insert(auditLogs).values({
    action: "request.force_rejected",
    entityType: "request",
    entityId: requestId,
    performedById: adminUserId,
    metadata: reason ? JSON.stringify({ reason }) : undefined,
  });

  return { success: true as const };
}

// ─── Admin cancel ─────────────────────────────────────────────────────────────

export async function adminCancelRequest(requestId: string, adminUserId: string, reason?: string) {
  const result = await transitionRequestStatus({
    requestId,
    fromStatus: "pending",
    toStatus: "cancelled",
    processedByUserId: adminUserId,
    reason,
  });

  if (!result.success) {
    return { error: result.error };
  }

  await db.insert(auditLogs).values({
    action: "request.cancelled",
    entityType: "request",
    entityId: requestId,
    performedById: adminUserId,
    metadata: reason ? JSON.stringify({ reason }) : undefined,
  });

  return { success: true as const };
}

// ─── Types for request detail ─────────────────────────────────────────────────

export interface AdminRequestDetail {
  id: string;
  filmId: string;
  exhibitorAccountId: string;
  rightsHolderAccountId: string;
  exhibitorName: string;
  rightsHolderName: string;
  filmTitle: string;
  cinemaName: string;
  roomName: string;
  status: RequestStatus;
  screeningCount: number;
  startDate: string | null;
  endDate: string | null;
  note: string | null;
  catalogPrice: number;
  displayedPrice: number;
  rightsHolderAmount: number;
  timelessAmount: number;
  deliveryFees: number;
  currency: string;
  platformMarginRate: string;
  commissionRate: string;
  rejectionReason: string | null;
  cancellationReason: string | null;
  approvalNote: string | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
}

// ─── Get request detail for admin ─────────────────────────────────────────────

export async function getRequestDetailForAdmin(
  requestId: string
): Promise<AdminRequestDetail | null> {
  const request = await db.query.requests.findFirst({
    where: eq(requests.id, requestId),
  });

  if (!request) return null;

  const [exhibitor, rightsHolder, film, cinema, room] = await Promise.all([
    db.query.accounts.findFirst({
      where: eq(accounts.id, request.exhibitorAccountId),
      columns: { companyName: true },
    }),
    db.query.accounts.findFirst({
      where: eq(accounts.id, request.rightsHolderAccountId),
      columns: { companyName: true },
    }),
    db.query.films.findFirst({
      where: eq(films.id, request.filmId),
      columns: { title: true },
    }),
    db.query.cinemas.findFirst({
      where: eq(cinemas.id, request.cinemaId),
      columns: { name: true },
    }),
    db.query.rooms.findFirst({
      where: eq(rooms.id, request.roomId),
      columns: { name: true },
    }),
  ]);

  return {
    id: request.id,
    filmId: request.filmId,
    exhibitorAccountId: request.exhibitorAccountId,
    rightsHolderAccountId: request.rightsHolderAccountId,
    exhibitorName: exhibitor?.companyName ?? "Unknown",
    rightsHolderName: rightsHolder?.companyName ?? "Unknown",
    filmTitle: film?.title ?? "Unknown",
    cinemaName: cinema?.name ?? "Unknown",
    roomName: room?.name ?? "Unknown",
    status: request.status as RequestStatus,
    screeningCount: request.screeningCount,
    startDate: request.startDate,
    endDate: request.endDate,
    note: request.note,
    catalogPrice: request.catalogPrice,
    displayedPrice: request.displayedPrice,
    rightsHolderAmount: request.rightsHolderAmount,
    timelessAmount: request.timelessAmount,
    deliveryFees: request.deliveryFees,
    currency: request.currency,
    platformMarginRate: request.platformMarginRate,
    commissionRate: request.commissionRate,
    rejectionReason: request.rejectionReason,
    cancellationReason: request.cancellationReason,
    approvalNote: request.approvalNote,
    approvedAt: request.approvedAt,
    rejectedAt: request.rejectedAt,
    cancelledAt: request.cancelledAt,
    paidAt: request.paidAt,
    createdAt: request.createdAt,
  };
}
