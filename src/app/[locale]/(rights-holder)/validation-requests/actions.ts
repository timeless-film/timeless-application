"use server";

import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getActiveAccountCookie } from "@/lib/auth/membership";
import { db } from "@/lib/db";
import { accounts, films, requests } from "@/lib/db/schema";
import { sendExhibitorRequestNotification } from "@/lib/services/booking-service";
import { transitionRequestStatus } from "@/lib/services/request-service";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const listIncomingRequestsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  tab: z.enum(["pending", "history"]).default("pending"),
  search: z.string().max(200).optional(),
});

const approveRequestSchema = z.object({
  requestId: z.string().uuid(),
  approvalNote: z.string().max(1000).optional(),
});

const rejectRequestSchema = z.object({
  requestId: z.string().uuid(),
  rejectionReason: z.string().max(1000).optional(),
});

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getAuthenticatedRightsHolder() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { error: "UNAUTHORIZED" as const };
  }

  const activeAccount = await getActiveAccountCookie();
  if (!activeAccount?.accountId) {
    return { error: "NO_ACTIVE_ACCOUNT" as const };
  }

  return { accountId: activeAccount.accountId, userId: session.user.id };
}

// ─── List incoming requests ───────────────────────────────────────────────────

export async function getIncomingRequests(input: z.infer<typeof listIncomingRequestsSchema>) {
  const authResult = await getAuthenticatedRightsHolder();
  if ("error" in authResult) {
    return authResult;
  }

  const parsed = listIncomingRequestsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "INVALID_INPUT" as const };
  }

  const { page, limit, tab, search } = parsed.data;
  const offset = (page - 1) * limit;

  const statusFilter =
    tab === "pending"
      ? eq(requests.status, "pending")
      : inArray(requests.status, ["approved", "rejected"]);

  const searchFilter = search?.trim()
    ? or(
        ilike(films.title, `%${search.trim()}%`),
        ilike(accounts.companyName, `%${search.trim()}%`)
      )
    : undefined;

  const baseConditions = and(
    eq(requests.rightsHolderAccountId, authResult.accountId),
    statusFilter
  );

  // When search is active, use a raw SQL approach to join and filter
  if (searchFilter) {
    const [rows, totals] = await Promise.all([
      db
        .select({ id: requests.id })
        .from(requests)
        .innerJoin(films, eq(requests.filmId, films.id))
        .innerJoin(accounts, eq(requests.exhibitorAccountId, accounts.id))
        .where(and(baseConditions, searchFilter))
        .orderBy(desc(requests.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)` })
        .from(requests)
        .innerJoin(films, eq(requests.filmId, films.id))
        .innerJoin(accounts, eq(requests.exhibitorAccountId, accounts.id))
        .where(and(baseConditions, searchFilter)),
    ]);

    const ids = rows.map((r) => r.id);
    const fullRows =
      ids.length > 0
        ? await db.query.requests.findMany({
            where: inArray(requests.id, ids),
            with: {
              film: { columns: { id: true, title: true, posterUrl: true } },
              exhibitorAccount: {
                columns: { id: true, companyName: true, country: true, vatNumber: true },
              },
              cinema: { columns: { id: true, name: true, city: true, country: true } },
              room: { columns: { id: true, name: true, capacity: true } },
              createdByUser: { columns: { id: true, name: true } },
            },
            orderBy: [desc(requests.createdAt)],
          })
        : [];

    return {
      success: true as const,
      data: fullRows,
      pagination: {
        page,
        limit,
        total: Number(totals[0]?.total ?? 0),
      },
    };
  }

  const [rows, totals] = await Promise.all([
    db.query.requests.findMany({
      where: baseConditions,
      with: {
        film: { columns: { id: true, title: true, posterUrl: true } },
        exhibitorAccount: {
          columns: { id: true, companyName: true, country: true, vatNumber: true },
        },
        cinema: { columns: { id: true, name: true, city: true, country: true } },
        room: { columns: { id: true, name: true, capacity: true } },
        createdByUser: { columns: { id: true, name: true } },
      },
      orderBy: [desc(requests.createdAt)],
      limit,
      offset,
    }),
    db
      .select({ total: sql<number>`count(*)` })
      .from(requests)
      .where(baseConditions),
  ]);

  return {
    success: true as const,
    data: rows,
    pagination: {
      page,
      limit,
      total: Number(totals[0]?.total ?? 0),
    },
  };
}

// ─── Get single request detail ────────────────────────────────────────────────

export async function getIncomingRequestDetail(requestId: string) {
  const authResult = await getAuthenticatedRightsHolder();
  if ("error" in authResult) {
    return authResult;
  }

  const idResult = z.string().uuid().safeParse(requestId);
  if (!idResult.success) {
    return { error: "INVALID_INPUT" as const };
  }

  const request = await db.query.requests.findFirst({
    where: and(
      eq(requests.id, idResult.data),
      eq(requests.rightsHolderAccountId, authResult.accountId)
    ),
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
      createdByUser: { columns: { id: true, name: true } },
      processedByUser: { columns: { id: true, name: true } },
    },
  });

  if (!request) {
    return { error: "REQUEST_NOT_FOUND" as const };
  }

  return { success: true as const, data: request };
}

// ─── Approve request ─────────────────────────────────────────────────────────

export async function approveRequest(input: z.infer<typeof approveRequestSchema>) {
  const authResult = await getAuthenticatedRightsHolder();
  if ("error" in authResult) {
    return authResult;
  }

  const parsed = approveRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "INVALID_INPUT" as const };
  }

  const result = await transitionRequestStatus({
    requestId: parsed.data.requestId,
    fromStatus: "pending",
    toStatus: "approved",
    rightsHolderAccountId: authResult.accountId,
    approvalNote: parsed.data.approvalNote,
    processedByUserId: authResult.userId,
  });

  if (!result.success) {
    return { error: result.error };
  }

  // Send notification emails to exhibitor (fire-and-forget)
  sendExhibitorRequestNotification({
    requestId: parsed.data.requestId,
    action: "approve",
    note: parsed.data.approvalNote,
  }).catch((err) => {
    console.error("Failed to send approval notification:", err);
  });

  return { success: true as const };
}

// ─── Reject request ──────────────────────────────────────────────────────────

export async function rejectRequest(input: z.infer<typeof rejectRequestSchema>) {
  const authResult = await getAuthenticatedRightsHolder();
  if ("error" in authResult) {
    return authResult;
  }

  const parsed = rejectRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "INVALID_INPUT" as const };
  }

  const result = await transitionRequestStatus({
    requestId: parsed.data.requestId,
    fromStatus: "pending",
    toStatus: "rejected",
    rightsHolderAccountId: authResult.accountId,
    reason: parsed.data.rejectionReason,
    processedByUserId: authResult.userId,
  });

  if (!result.success) {
    return { error: result.error };
  }

  // Send notification emails to exhibitor (fire-and-forget)
  sendExhibitorRequestNotification({
    requestId: parsed.data.requestId,
    action: "reject",
    note: parsed.data.rejectionReason,
  }).catch((err) => {
    console.error("Failed to send rejection notification:", err);
  });

  return { success: true as const };
}
