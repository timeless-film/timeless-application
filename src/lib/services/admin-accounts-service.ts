import { and, count, eq, ilike, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  accountMembers,
  accounts,
  auditLogs,
  betterAuthUsers,
  cinemas,
  films,
  orderItems,
  orders,
  requests,
} from "@/lib/db/schema";

interface ListAccountsOptions {
  type: "rights_holder" | "exhibitor";
  page: number;
  limit: number;
  search?: string;
  status?: "active" | "suspended";
}

export interface AdminAccountRow {
  id: string;
  companyName: string;
  country: string;
  status: "active" | "suspended";
  commissionRate: string | null;
  stripeConnectOnboardingComplete: boolean | null;
  onboardingCompleted: boolean;
  activeFilmCount: number;
  orderItemCount: number;
  cinemaCount: number;
  orderCount: number;
  createdAt: Date;
}

export async function listAccountsForAdmin(options: ListAccountsOptions) {
  const { type, page, limit, search, status } = options;
  const offset = (page - 1) * limit;

  const conditions = [eq(accounts.type, type)];
  if (status) {
    conditions.push(eq(accounts.status, status));
  }
  if (search?.trim()) {
    conditions.push(ilike(accounts.companyName, `%${search.trim()}%`));
  }

  const whereClause = and(...conditions);

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: accounts.id,
        companyName: accounts.companyName,
        country: accounts.country,
        status: accounts.status,
        commissionRate: accounts.commissionRate,
        stripeConnectOnboardingComplete: accounts.stripeConnectOnboardingComplete,
        onboardingCompleted: accounts.onboardingCompleted,
        createdAt: accounts.createdAt,
        activeFilmCount: sql<number>`(
          SELECT count(*)::int FROM ${films}
          WHERE ${films.accountId} = ${accounts.id}
          AND ${films.status} = 'active'
        )`,
        orderItemCount: sql<number>`(
          SELECT count(*)::int FROM ${orderItems}
          WHERE ${orderItems.rightsHolderAccountId} = ${accounts.id}
        )`,
        cinemaCount: sql<number>`(
          SELECT count(*)::int FROM ${cinemas}
          WHERE ${cinemas.accountId} = ${accounts.id}
          AND ${cinemas.archivedAt} IS NULL
        )`,
        orderCount: sql<number>`(
          SELECT count(*)::int FROM ${orders}
          WHERE ${orders.exhibitorAccountId} = ${accounts.id}
        )`,
      })
      .from(accounts)
      .where(whereClause)
      .orderBy(accounts.companyName)
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(accounts).where(whereClause),
  ]);

  return {
    accounts: rows as AdminAccountRow[],
    total: totalResult[0]?.count ?? 0,
  };
}

export async function suspendAccount(accountId: string, adminUserId: string) {
  await db.transaction(async (tx) => {
    await tx.update(accounts).set({ status: "suspended" }).where(eq(accounts.id, accountId));

    await tx.insert(auditLogs).values({
      action: "account.suspended",
      entityType: "account",
      entityId: accountId,
      performedById: adminUserId,
    });
  });
}

export async function reactivateAccount(accountId: string, adminUserId: string) {
  await db.transaction(async (tx) => {
    await tx.update(accounts).set({ status: "active" }).where(eq(accounts.id, accountId));

    await tx.insert(auditLogs).values({
      action: "account.reactivated",
      entityType: "account",
      entityId: accountId,
      performedById: adminUserId,
    });
  });
}

export async function updateAccountCommissionRate(
  accountId: string,
  newRate: string | null,
  adminUserId: string
) {
  const existing = await db.query.accounts.findFirst({
    where: (a, { eq: e }) => e(a.id, accountId),
    columns: { commissionRate: true },
  });

  await db.transaction(async (tx) => {
    await tx.update(accounts).set({ commissionRate: newRate }).where(eq(accounts.id, accountId));

    await tx.insert(auditLogs).values({
      action: "commission.updated",
      entityType: "account",
      entityId: accountId,
      performedById: adminUserId,
      metadata: JSON.stringify({
        oldRate: existing?.commissionRate ?? null,
        newRate,
      }),
    });
  });
}

export async function getAccountDetail(accountId: string) {
  const account = await db.query.accounts.findFirst({
    where: (a, { eq: e }) => e(a.id, accountId),
  });
  if (!account) return null;

  const [members, filmCount, orderCount, cinemaCount, commissionHistory] = await Promise.all([
    db
      .select({
        userId: accountMembers.userId,
        role: accountMembers.role,
        createdAt: accountMembers.createdAt,
        name: betterAuthUsers.name,
        email: betterAuthUsers.email,
      })
      .from(accountMembers)
      .innerJoin(betterAuthUsers, eq(accountMembers.userId, betterAuthUsers.id))
      .where(eq(accountMembers.accountId, accountId)),
    db
      .select({ count: count() })
      .from(films)
      .where(and(eq(films.accountId, accountId), eq(films.status, "active"))),
    db
      .select({ count: count() })
      .from(orderItems)
      .where(eq(orderItems.rightsHolderAccountId, accountId)),
    db
      .select({ count: count() })
      .from(cinemas)
      .where(and(eq(cinemas.accountId, accountId), sql`${cinemas.archivedAt} IS NULL`)),
    db.query.auditLogs.findMany({
      where: (l, { eq: e, and: a }) =>
        a(e(l.entityId, accountId), e(l.action, "commission.updated")),
      orderBy: (l, { desc }) => desc(l.createdAt),
      limit: 20,
    }),
  ]);

  return {
    account,
    members,
    activeFilmCount: filmCount[0]?.count ?? 0,
    orderItemCount: orderCount[0]?.count ?? 0,
    cinemaCount: cinemaCount[0]?.count ?? 0,
    commissionHistory,
  };
}

// ─── Account orders ───────────────────────────────────────────────────────────

export interface AccountOrderRow {
  orderId: string;
  orderNumber: number;
  counterpartyName: string;
  paidAt: Date;
  total: number;
  itemCount: number;
  status: string;
  currency: string;
}

export async function getOrdersForAccount(
  accountId: string,
  role: "exhibitor" | "rights_holder"
): Promise<AccountOrderRow[]> {
  if (role === "exhibitor") {
    const rows = await db
      .select({
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        counterpartyName: sql<string>`'—'`, // exhibitor is the buyer
        paidAt: orders.paidAt,
        total: orders.total,
        itemCount: sql<number>`(
          SELECT count(*)::int FROM ${orderItems}
          WHERE ${orderItems.orderId} = ${orders.id}
        )`,
        status: orders.status,
        currency: orders.currency,
      })
      .from(orders)
      .where(eq(orders.exhibitorAccountId, accountId))
      .orderBy(sql`${orders.paidAt} DESC`);

    return rows as AccountOrderRow[];
  }

  // rights_holder: orders where at least one item belongs to this RH
  const rows = await db
    .select({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      counterpartyName: sql<string>`(
        SELECT ${accounts.companyName} FROM ${accounts}
        WHERE ${accounts.id} = ${orders.exhibitorAccountId}
      )`,
      paidAt: orders.paidAt,
      total: sql<number>`COALESCE(SUM(${orderItems.displayedPrice}), 0)`,
      itemCount: count(),
      status: orders.status,
      currency: orders.currency,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(eq(orderItems.rightsHolderAccountId, accountId))
    .groupBy(
      orders.id,
      orders.orderNumber,
      orders.paidAt,
      orders.total,
      orders.status,
      orders.currency,
      orders.exhibitorAccountId
    )
    .orderBy(sql`${orders.paidAt} DESC`);

  return rows as AccountOrderRow[];
}

// ─── Account requests ─────────────────────────────────────────────────────────

export interface AccountRequestRow {
  id: string;
  filmId: string;
  filmTitle: string;
  filmPosterUrl: string | null;
  counterpartyAccountId: string;
  counterpartyName: string;
  status: string;
  displayedPrice: number;
  currency: string;
  createdAt: Date;
}

export async function getRequestsForAccount(
  accountId: string,
  role: "exhibitor" | "rights_holder"
): Promise<AccountRequestRow[]> {
  const accountField =
    role === "exhibitor" ? requests.exhibitorAccountId : requests.rightsHolderAccountId;

  const counterpartyField =
    role === "exhibitor" ? requests.rightsHolderAccountId : requests.exhibitorAccountId;

  const rows = await db
    .select({
      id: requests.id,
      filmId: requests.filmId,
      filmTitle: sql<string>`(
        SELECT ${films.title} FROM ${films}
        WHERE ${films.id} = ${requests.filmId}
      )`,
      filmPosterUrl: sql<string | null>`(
        SELECT ${films.posterUrl} FROM ${films}
        WHERE ${films.id} = ${requests.filmId}
      )`,
      counterpartyAccountId: counterpartyField,
      counterpartyName: sql<string>`(
        SELECT ${accounts.companyName} FROM ${accounts}
        WHERE ${accounts.id} = ${counterpartyField}
      )`,
      status: requests.status,
      displayedPrice: requests.displayedPrice,
      currency: requests.currency,
      createdAt: requests.createdAt,
    })
    .from(requests)
    .where(eq(accountField, accountId))
    .orderBy(sql`${requests.createdAt} DESC`);

  return rows as AccountRequestRow[];
}

// ─── Account sales totals ─────────────────────────────────────────────────────

export interface AccountSalesTotals {
  totalVolume: number; // in cents
  totalMargin: number; // in cents
  orderCount: number;
}

export async function getAccountSalesTotals(
  accountId: string,
  role: "exhibitor" | "rights_holder"
): Promise<AccountSalesTotals> {
  if (role === "exhibitor") {
    const [row] = await db
      .select({
        totalVolume: sql<number>`COALESCE(SUM(${orders.subtotal}), 0)`,
        orderCount: count(),
      })
      .from(orders)
      .where(and(eq(orders.exhibitorAccountId, accountId), eq(orders.status, "paid")));

    return {
      totalVolume: Number(row?.totalVolume ?? 0),
      totalMargin: 0,
      orderCount: Number(row?.orderCount ?? 0),
    };
  }

  // rights_holder
  const [row] = await db
    .select({
      totalVolume: sql<number>`COALESCE(SUM(${orderItems.displayedPrice}), 0)`,
      totalMargin: sql<number>`COALESCE(SUM(${orderItems.timelessAmount}), 0)`,
      orderCount: count(),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orderItems.rightsHolderAccountId, accountId), eq(orders.status, "paid")));

  return {
    totalVolume: Number(row?.totalVolume ?? 0),
    totalMargin: Number(row?.totalMargin ?? 0),
    orderCount: Number(row?.orderCount ?? 0),
  };
}
