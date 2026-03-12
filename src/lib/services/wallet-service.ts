import { and, count, eq, gte, lt, sql, sum } from "drizzle-orm";

import { db } from "@/lib/db";
import { cinemas, films, orderItems, orders } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe";
import { formatOrderNumber } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AmountByCurrency {
  amount: number;
  currency: string;
}

export interface WalletBalance {
  available: AmountByCurrency[];
  pending: AmountByCurrency[];
}

export interface WalletTransaction {
  id: string;
  date: Date;
  filmTitle: string;
  cinemaName: string;
  orderNumber: string;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  taxAmount: number; // RH's share of VAT (agent model)
  currency: string;
}

export interface WalletPayout {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "in_transit" | "paid" | "failed" | "canceled";
  createdAt: Date;
  arrivalDate: Date;
  bankLast4?: string;
  failureMessage?: string;
}

export interface RevenueChartPoint {
  date: string;
  amount: number;
}

export interface RevenueChartSeries {
  currency: string;
  points: RevenueChartPoint[];
}

export interface SalesCountPoint {
  date: string;
  count: number;
}

export interface FilmTransaction {
  date: Date;
  cinemaName: string;
  orderNumber: string;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  taxAmount: number;
  currency: string;
}

export type WeeklyAnchor =
  | "friday"
  | "monday"
  | "saturday"
  | "sunday"
  | "thursday"
  | "tuesday"
  | "wednesday";

export interface PayoutSchedule {
  interval: "manual" | "daily" | "weekly" | "monthly";
  weeklyAnchor?: WeeklyAnchor;
  monthlyAnchor?: number;
}

export type PayoutScheduleInput =
  | { interval: "manual" }
  | { interval: "daily" }
  | { interval: "weekly"; weeklyAnchor: WeeklyAnchor }
  | { interval: "monthly"; monthlyAnchor: number };

// ─── Balance ──────────────────────────────────────────────────────────────────

export async function getWalletBalance(stripeConnectAccountId: string): Promise<WalletBalance> {
  const balance = await stripe.balance.retrieve({
    stripeAccount: stripeConnectAccountId,
  });

  return {
    available: balance.available.map((b) => ({ amount: b.amount, currency: b.currency })),
    pending: balance.pending.map((b) => ({ amount: b.amount, currency: b.currency })),
  };
}

// ─── Transactions (Stripe transfers + TIMELESS enrichment) ───────────────────

export async function getWalletTransactions(
  stripeConnectAccountId: string,
  accountId: string,
  options?: { limit?: number; startingAfter?: string }
): Promise<{ transactions: WalletTransaction[]; hasMore: boolean; nextCursor?: string }> {
  const limit = options?.limit ?? 10;

  const transferList = await stripe.transfers.list({
    destination: stripeConnectAccountId,
    limit,
    starting_after: options?.startingAfter,
  });

  if (transferList.data.length === 0) {
    return { transactions: [], hasMore: false };
  }

  // Collect order_item_ids from transfer metadata for batch enrichment
  const orderItemIds = transferList.data
    .map((t) => t.metadata?.order_item_id)
    .filter((id): id is string => Boolean(id));

  // Batch query: get all orderItems with film/cinema/order data in one query
  const enrichmentRows =
    orderItemIds.length > 0
      ? await db
          .select({
            orderItemId: orderItems.id,
            filmTitle: films.title,
            cinemaName: cinemas.name,
            orderNumber: orders.orderNumber,
            catalogPrice: orderItems.catalogPrice,
            rightsHolderAmount: orderItems.rightsHolderAmount,
            rightsHolderTaxAmount: orderItems.rightsHolderTaxAmount,
            screeningCount: orderItems.screeningCount,
            currency: orderItems.currency,
          })
          .from(orderItems)
          .innerJoin(films, eq(orderItems.filmId, films.id))
          .innerJoin(cinemas, eq(orderItems.cinemaId, cinemas.id))
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(sql`${orderItems.id} IN ${orderItemIds}`)
      : [];

  // Build lookup map
  const enrichmentMap = new Map(enrichmentRows.map((row) => [row.orderItemId, row]));

  // Merge Stripe data with TIMELESS data
  const transactions: WalletTransaction[] = transferList.data.map((transfer) => {
    const orderItemId = transfer.metadata?.order_item_id;
    const enrichment = orderItemId ? enrichmentMap.get(orderItemId) : undefined;

    return {
      id: transfer.id,
      date: new Date(transfer.created * 1000),
      filmTitle: enrichment?.filmTitle ?? "—",
      cinemaName: enrichment?.cinemaName ?? "—",
      orderNumber: enrichment ? formatOrderNumber(enrichment.orderNumber) : "—",
      grossAmount: enrichment
        ? enrichment.catalogPrice * enrichment.screeningCount
        : transfer.amount,
      commissionAmount: enrichment
        ? (enrichment.catalogPrice - enrichment.rightsHolderAmount) * enrichment.screeningCount
        : 0,
      netAmount: enrichment
        ? enrichment.rightsHolderAmount * enrichment.screeningCount
        : transfer.amount,
      taxAmount: enrichment ? enrichment.rightsHolderTaxAmount : 0,
      currency: enrichment?.currency ?? transfer.currency,
    };
  });

  return {
    transactions,
    hasMore: transferList.has_more,
    nextCursor:
      transferList.data.length > 0
        ? transferList.data[transferList.data.length - 1]?.id
        : undefined,
  };
}

// ─── Payout history ───────────────────────────────────────────────────────────

export async function getPayoutHistory(
  stripeConnectAccountId: string,
  options?: { limit?: number; startingAfter?: string }
): Promise<{ payouts: WalletPayout[]; hasMore: boolean; nextCursor?: string }> {
  const limit = options?.limit ?? 10;

  const payoutList = await stripe.payouts.list(
    { limit, starting_after: options?.startingAfter },
    { stripeAccount: stripeConnectAccountId }
  );

  const payouts: WalletPayout[] = payoutList.data.map((payout) => ({
    id: payout.id,
    amount: payout.amount,
    currency: payout.currency,
    status: payout.status as WalletPayout["status"],
    createdAt: new Date(payout.created * 1000),
    arrivalDate: new Date(payout.arrival_date * 1000),
    bankLast4:
      payout.destination && typeof payout.destination === "object"
        ? (payout.destination as { last4?: string }).last4
        : undefined,
    failureMessage: payout.failure_message ?? undefined,
  }));

  return {
    payouts,
    hasMore: payoutList.has_more,
    nextCursor:
      payoutList.data.length > 0 ? payoutList.data[payoutList.data.length - 1]?.id : undefined,
  };
}

// ─── Manual payout ────────────────────────────────────────────────────────────

export async function createManualPayout(
  stripeConnectAccountId: string,
  amount: number,
  currency: string
): Promise<{ payoutId: string; arrivalDate: Date }> {
  const payout = await stripe.payouts.create(
    { amount, currency: currency.toLowerCase() },
    { stripeAccount: stripeConnectAccountId }
  );

  return {
    payoutId: payout.id,
    arrivalDate: new Date(payout.arrival_date * 1000),
  };
}

// ─── Payout schedule ──────────────────────────────────────────────────────────

export async function getPayoutSchedule(stripeConnectAccountId: string): Promise<PayoutSchedule> {
  const account = await stripe.accounts.retrieve(stripeConnectAccountId);
  const schedule = account.settings?.payouts?.schedule;

  if (!schedule || schedule.interval === "manual") {
    return { interval: "manual" };
  }

  return {
    interval: schedule.interval as "daily" | "weekly" | "monthly",
    weeklyAnchor: (schedule.weekly_anchor as WeeklyAnchor) ?? undefined,
    monthlyAnchor: schedule.monthly_anchor ?? undefined,
  };
}

export async function updatePayoutSchedule(
  stripeConnectAccountId: string,
  schedule: PayoutScheduleInput
): Promise<void> {
  const scheduleParams: {
    interval: "manual" | "daily" | "weekly" | "monthly";
    weekly_anchor?: WeeklyAnchor;
    monthly_anchor?: number;
  } = { interval: schedule.interval };

  if (schedule.interval === "weekly") {
    scheduleParams.weekly_anchor = schedule.weeklyAnchor;
  } else if (schedule.interval === "monthly") {
    scheduleParams.monthly_anchor = schedule.monthlyAnchor;
  }

  await stripe.accounts.update(stripeConnectAccountId, {
    settings: {
      payouts: {
        schedule: scheduleParams,
      },
    },
  });
}

// ─── Revenue stats (DB-based, not Stripe API) ────────────────────────────────

export async function getRevenueStats(
  accountId: string
): Promise<{ currentMonth: AmountByCurrency[]; previousMonth: AmountByCurrency[] }> {
  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const totalRevenue = sql<number>`${orderItems.rightsHolderAmount} * ${orderItems.screeningCount}`;

  const [currentMonthRows, previousMonthRows] = await Promise.all([
    db
      .select({
        currency: orderItems.currency,
        total: sum(totalRevenue),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orderItems.rightsHolderAccountId, accountId),
          gte(orders.paidAt, startOfCurrentMonth)
        )
      )
      .groupBy(orderItems.currency),
    db
      .select({
        currency: orderItems.currency,
        total: sum(totalRevenue),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(
        and(
          eq(orderItems.rightsHolderAccountId, accountId),
          gte(orders.paidAt, startOfPreviousMonth),
          lt(orders.paidAt, startOfCurrentMonth)
        )
      )
      .groupBy(orderItems.currency),
  ]);

  return {
    currentMonth: currentMonthRows.map((row) => ({
      amount: Number(row.total ?? 0),
      currency: row.currency,
    })),
    previousMonth: previousMonthRows.map((row) => ({
      amount: Number(row.total ?? 0),
      currency: row.currency,
    })),
  };
}

// ─── Revenue chart (DB-based) ─────────────────────────────────────────────────

export async function getRevenueChart(
  accountId: string,
  period: "30d" | "12m"
): Promise<{ series: RevenueChartSeries[]; salesCounts: SalesCountPoint[] }> {
  const now = new Date();
  let startDate: Date;
  let truncUnit: string;

  if (period === "30d") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    truncUnit = "day";
  } else {
    startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    truncUnit = "month";
  }

  const dateTrunc = sql<string>`DATE_TRUNC(${sql.raw(`'${truncUnit}'`)}, ${orders.paidAt})::date`;

  const [revenueRows, salesRows] = await Promise.all([
    db
      .select({
        date: dateTrunc.as("date"),
        currency: orderItems.currency,
        total: sum(sql`${orderItems.rightsHolderAmount} * ${orderItems.screeningCount}`),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orderItems.rightsHolderAccountId, accountId), gte(orders.paidAt, startDate)))
      .groupBy(
        sql`DATE_TRUNC(${sql.raw(`'${truncUnit}'`)}, ${orders.paidAt})::date`,
        orderItems.currency
      )
      .orderBy(sql`date`),
    db
      .select({
        date: sql<string>`DATE_TRUNC(${sql.raw(`'${truncUnit}'`)}, ${orders.paidAt})::date`.as(
          "date"
        ),
        count: count(),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(and(eq(orderItems.rightsHolderAccountId, accountId), gte(orders.paidAt, startDate)))
      .groupBy(sql`DATE_TRUNC(${sql.raw(`'${truncUnit}'`)}, ${orders.paidAt})::date`)
      .orderBy(sql`date`),
  ]);

  // Group revenue by currency into series
  const seriesMap = new Map<string, RevenueChartPoint[]>();

  for (const row of revenueRows) {
    const currency = row.currency;
    if (!seriesMap.has(currency)) {
      seriesMap.set(currency, []);
    }
    seriesMap.get(currency)!.push({
      date: row.date,
      amount: Number(row.total ?? 0),
    });
  }

  const series: RevenueChartSeries[] = Array.from(seriesMap.entries()).map(
    ([currency, points]) => ({ currency, points })
  );

  const salesCounts: SalesCountPoint[] = salesRows.map((row) => ({
    date: row.date,
    count: Number(row.count),
  }));

  return { series, salesCounts };
}

// ─── Transactions for a specific film ─────────────────────────────────────────

export async function getTransactionsForFilm(
  accountId: string,
  filmId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ transactions: FilmTransaction[]; total: number }> {
  const limit = options?.limit ?? 10;
  const offset = options?.offset ?? 0;

  const [rows, countResult] = await Promise.all([
    db
      .select({
        paidAt: orders.paidAt,
        cinemaName: cinemas.name,
        orderNumber: orders.orderNumber,
        catalogPrice: orderItems.catalogPrice,
        rightsHolderAmount: orderItems.rightsHolderAmount,
        rightsHolderTaxAmount: orderItems.rightsHolderTaxAmount,
        screeningCount: orderItems.screeningCount,
        currency: orderItems.currency,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(cinemas, eq(orderItems.cinemaId, cinemas.id))
      .where(and(eq(orderItems.rightsHolderAccountId, accountId), eq(orderItems.filmId, filmId)))
      .orderBy(sql`${orders.paidAt} DESC`)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(orderItems)
      .where(and(eq(orderItems.rightsHolderAccountId, accountId), eq(orderItems.filmId, filmId))),
  ]);

  return {
    transactions: rows.map((row) => ({
      date: row.paidAt,
      cinemaName: row.cinemaName,
      orderNumber: formatOrderNumber(row.orderNumber),
      grossAmount: row.catalogPrice * row.screeningCount,
      commissionAmount: (row.catalogPrice - row.rightsHolderAmount) * row.screeningCount,
      netAmount: row.rightsHolderAmount * row.screeningCount,
      taxAmount: row.rightsHolderTaxAmount,
      currency: row.currency,
    })),
    total: countResult[0]?.count ?? 0,
  };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Formats an amount in cents to a display string like "150.00".
 * Unlike formatAmount() from pricing, this returns a plain number
 * string suitable for CSV exports and data contexts.
 */
export function formatAmountForDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}
