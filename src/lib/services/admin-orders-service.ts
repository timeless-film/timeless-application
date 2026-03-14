import { and, count, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts, auditLogs, orderItems, orders } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = "paid" | "processing" | "delivered" | "refunded";

export interface AdminOrderRow {
  id: string;
  orderNumber: number;
  exhibitorAccountId: string;
  exhibitorName: string;
  paidAt: Date;
  itemCount: number;
  total: number;
  currency: string;
  status: OrderStatus;
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: number;
  exhibitorAccountId: string;
  exhibitorName: string;
  status: OrderStatus;
  subtotal: number;
  deliveryFeesTotal: number;
  taxAmount: number;
  total: number;
  currency: string;
  taxRate: string | null;
  vatNumber: string | null;
  reverseCharge: string | null;
  stripePaymentIntentId: string;
  stripeInvoiceId: string | null;
  paidAt: Date;
  items: AdminOrderItem[];
}

export interface AdminOrderItem {
  id: string;
  filmId: string;
  filmTitle: string;
  filmPosterUrl: string | null;
  rightsHolderAccountId: string;
  rightsHolderName: string;
  cinemaName: string;
  roomName: string;
  startDate: string | null;
  endDate: string | null;
  screeningCount: number;
  displayedPrice: number;
  rightsHolderAmount: number;
  timelessAmount: number;
  currency: string;
  deliveryFees: number;
  deliveryStatus: "pending" | "in_progress" | "delivered";
  stripeTransferId: string | null;
}

interface ListOrdersOptions {
  page: number;
  limit: number;
  search?: string;
  status?: OrderStatus;
}

// ─── List orders for admin ────────────────────────────────────────────────────

export async function listOrdersForAdmin(options: ListOrdersOptions) {
  const { page, limit, search, status } = options;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (status) {
    conditions.push(eq(orders.status, status));
  }
  if (search?.trim()) {
    const term = search.trim();
    conditions.push(
      sql`(
        ${orders.orderNumber}::text ILIKE ${"%" + term + "%"}
        OR EXISTS (
          SELECT 1 FROM ${accounts}
          WHERE ${accounts.id} = ${orders.exhibitorAccountId}
          AND ${accounts.companyName} ILIKE ${"%" + term + "%"}
        )
      )` as ReturnType<typeof eq>
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        exhibitorAccountId: orders.exhibitorAccountId,
        exhibitorName: sql<string>`(
          SELECT ${accounts.companyName} FROM ${accounts}
          WHERE ${accounts.id} = ${orders.exhibitorAccountId}
        )`.as("exhibitor_name"),
        paidAt: orders.paidAt,
        itemCount: sql<number>`(
          SELECT count(*) FROM ${orderItems}
          WHERE ${orderItems.orderId} = ${orders.id}
        )`.as("item_count"),
        total: orders.total,
        currency: orders.currency,
        status: orders.status,
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.paidAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(orders).where(where),
  ]);

  const orderRows: AdminOrderRow[] = rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    exhibitorAccountId: r.exhibitorAccountId,
    exhibitorName: r.exhibitorName ?? "Unknown",
    paidAt: r.paidAt,
    itemCount: Number(r.itemCount ?? 0),
    total: r.total,
    currency: r.currency,
    status: r.status as OrderStatus,
  }));

  return { orders: orderRows, total: Number(countRow?.total ?? 0) };
}

// ─── Get order detail for admin ───────────────────────────────────────────────

export async function getOrderDetailForAdmin(orderId: string): Promise<AdminOrderDetail | null> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      items: {
        with: {
          film: { columns: { id: true, title: true, posterUrl: true } },
          cinema: { columns: { id: true, name: true } },
          room: { columns: { id: true, name: true } },
        },
        orderBy: [desc(orderItems.createdAt)],
      },
    },
  });

  if (!order) return null;

  // Get exhibitor name
  const exhibitor = await db.query.accounts.findFirst({
    where: eq(accounts.id, order.exhibitorAccountId),
    columns: { companyName: true },
  });

  // Get rights holder names for each item
  const rhIds = [...new Set(order.items.map((i) => i.rightsHolderAccountId))];
  const rhAccounts =
    rhIds.length > 0
      ? await db.query.accounts.findMany({
          where: sql`${accounts.id} IN (${sql.join(
            rhIds.map((id) => sql`${id}`),
            sql`, `
          )})`,
          columns: { id: true, companyName: true },
        })
      : [];
  const rhMap = new Map(rhAccounts.map((a) => [a.id, a.companyName ?? "Unknown"]));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    exhibitorAccountId: order.exhibitorAccountId,
    exhibitorName: exhibitor?.companyName ?? "Unknown",
    status: order.status as OrderStatus,
    subtotal: order.subtotal,
    deliveryFeesTotal: order.deliveryFeesTotal,
    taxAmount: order.taxAmount,
    total: order.total,
    currency: order.currency,
    taxRate: order.taxRate,
    vatNumber: order.vatNumber,
    reverseCharge: order.reverseCharge,
    stripePaymentIntentId: order.stripePaymentIntentId,
    stripeInvoiceId: order.stripeInvoiceId,
    paidAt: order.paidAt,
    items: order.items.map((item) => ({
      id: item.id,
      filmId: item.filmId,
      filmTitle: item.film?.title ?? "Unknown",
      filmPosterUrl: item.film?.posterUrl ?? null,
      rightsHolderAccountId: item.rightsHolderAccountId,
      rightsHolderName: rhMap.get(item.rightsHolderAccountId) ?? "Unknown",
      cinemaName: item.cinema?.name ?? "Unknown",
      roomName: item.room?.name ?? "Unknown",
      startDate: item.startDate,
      endDate: item.endDate,
      screeningCount: item.screeningCount,
      displayedPrice: item.displayedPrice,
      rightsHolderAmount: item.rightsHolderAmount,
      timelessAmount: item.timelessAmount,
      currency: item.currency,
      deliveryFees: item.deliveryFees,
      deliveryStatus: item.deliveryStatus as "pending" | "in_progress" | "delivered",
      stripeTransferId: item.stripeTransferId,
    })),
  };
}

// ─── Refund order ─────────────────────────────────────────────────────────────

const REFUND_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours

export async function refundOrder(
  orderId: string,
  adminUserId: string,
  reason: string
): Promise<{ success: true } | { error: string }> {
  // 1. Fetch order
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      items: {
        columns: { id: true, stripeTransferId: true },
      },
    },
  });

  if (!order) return { error: "ORDER_NOT_FOUND" };

  // 2. Check status
  if (order.status !== "paid" && order.status !== "processing") {
    return { error: "ORDER_NOT_REFUNDABLE" };
  }

  // 3. Check 48h window
  const elapsed = Date.now() - order.paidAt.getTime();
  if (elapsed > REFUND_WINDOW_MS) {
    return { error: "REFUND_WINDOW_EXPIRED" };
  }

  // 4. Stripe refund on PaymentIntent
  try {
    await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
    });
  } catch (error) {
    console.error("Stripe refund failed:", error);
    return { error: "STRIPE_REFUND_FAILED" };
  }

  // 5. Reverse all transfers
  for (const item of order.items) {
    if (item.stripeTransferId) {
      try {
        await stripe.transfers.createReversal(item.stripeTransferId);
      } catch (error) {
        console.error(`Transfer reversal failed for ${item.stripeTransferId}:`, error);
        // Continue — the refund already happened, we log the failure
      }
    }
  }

  // 6. Update DB in transaction
  await db.transaction(async (tx) => {
    // Set order status to refunded
    await tx
      .update(orders)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(eq(orders.id, orderId));

    // Reset all delivery statuses
    await tx
      .update(orderItems)
      .set({
        deliveryStatus: "pending",
        deliveryNotes: null,
        deliveredAt: null,
      })
      .where(eq(orderItems.orderId, orderId));

    // Audit log
    await tx.insert(auditLogs).values({
      action: "order.refunded",
      entityType: "order",
      entityId: orderId,
      performedById: adminUserId,
      metadata: JSON.stringify({
        orderNumber: order.orderNumber,
        reason,
        total: order.total,
        currency: order.currency,
      }),
    });
  });

  return { success: true };
}
