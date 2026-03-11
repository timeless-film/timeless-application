import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { orders, orderItems } from "@/lib/db/schema";

import type { SQL } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = "paid" | "processing" | "delivered" | "refunded";

// ─── List orders for exhibitor ────────────────────────────────────────────────

export async function getOrdersForExhibitor(params: {
  exhibitorAccountId: string;
  page: number;
  limit: number;
  status?: OrderStatus;
}) {
  const { exhibitorAccountId, page, limit, status } = params;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [eq(orders.exhibitorAccountId, exhibitorAccountId)];
  if (status) {
    conditions.push(eq(orders.status, status));
  }

  const where = and(...conditions);

  const [rows, [countRow]] = await Promise.all([
    db.query.orders.findMany({
      where,
      with: {
        items: {
          with: {
            film: { columns: { id: true, title: true } },
            cinema: { columns: { id: true, name: true } },
          },
        },
      },
      orderBy: [desc(orders.paidAt)],
      limit,
      offset,
    }),
    db
      .select({ total: sql<number>`count(*)` })
      .from(orders)
      .where(where),
  ]);

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: Number(countRow?.total ?? 0),
    },
  };
}

// ─── Get order detail ─────────────────────────────────────────────────────────

export async function getOrderDetail(params: { orderId: string; exhibitorAccountId: string }) {
  const { orderId, exhibitorAccountId } = params;

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.exhibitorAccountId, exhibitorAccountId)),
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

  return order ?? null;
}
