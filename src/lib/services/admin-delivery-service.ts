import { and, count, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts, auditLogs, orderItems, orders } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeliveryStatus = "pending" | "in_progress" | "delivered";

export interface AdminDeliveryRow {
  orderItemId: string;
  orderNumber: number;
  orderId: string;
  filmTitle: string;
  filmId: string;
  cinemaName: string;
  roomName: string;
  rightsHolderName: string;
  startDate: string | null;
  endDate: string | null;
  screeningCount: number;
  deliveryStatus: DeliveryStatus;
  deliveryNotes: string | null;
  labOrderNumber: string | null;
  deliveredAt: Date | null;
  paidAt: Date;
  urgencyDays: number | null;
}

interface ListDeliveriesOptions {
  page: number;
  limit: number;
  status?: DeliveryStatus;
  search?: string;
  urgencyOnly?: boolean;
  deliveryUrgencyDaysBeforeStart?: number;
}

// ─── Allowed status transitions ───────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending: ["in_progress", "delivered"],
  in_progress: ["delivered", "pending"],
  delivered: [],
};

export function isValidTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── List deliveries for admin ────────────────────────────────────────────────

export async function listDeliveriesForAdmin(options: ListDeliveriesOptions) {
  const { page, limit, status, search, urgencyOnly, deliveryUrgencyDaysBeforeStart } = options;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];

  // Only show items from non-refunded orders
  conditions.push(sql`${orders.status} != 'refunded'` as ReturnType<typeof eq>);

  if (status) {
    conditions.push(eq(orderItems.deliveryStatus, status));
  }

  if (search?.trim()) {
    const term = search.trim();
    conditions.push(
      sql`(
        EXISTS (
          SELECT 1 FROM films
          WHERE films.id = ${orderItems.filmId}
          AND films.title ILIKE ${"%" + term + "%"}
        )
        OR EXISTS (
          SELECT 1 FROM cinemas
          WHERE cinemas.id = ${orderItems.cinemaId}
          AND cinemas.name ILIKE ${"%" + term + "%"}
        )
        OR ${orders.orderNumber}::text ILIKE ${"%" + term + "%"}
        OR ${orderItems.labOrderNumber} ILIKE ${"%" + term + "%"}
      )` as ReturnType<typeof eq>
    );
  }

  if (urgencyOnly && deliveryUrgencyDaysBeforeStart) {
    conditions.push(
      sql`${orderItems.startDate} IS NOT NULL
        AND ${orderItems.deliveryStatus} != 'delivered'
        AND ${orderItems.startDate}::date - CURRENT_DATE <= ${deliveryUrgencyDaysBeforeStart}` as ReturnType<
        typeof eq
      >
    );
  }

  const where = and(...conditions);

  // Default sort: most urgent first (earliest startDate), nulls last
  const orderBy = sql`CASE
    WHEN ${orderItems.startDate} IS NULL THEN 1 ELSE 0
  END ASC, ${orderItems.startDate} ASC, ${orders.paidAt} DESC`;

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        orderItemId: orderItems.id,
        orderId: orderItems.orderId,
        filmId: orderItems.filmId,
        cinemaId: orderItems.cinemaId,
        roomId: orderItems.roomId,
        rightsHolderAccountId: orderItems.rightsHolderAccountId,
        startDate: orderItems.startDate,
        endDate: orderItems.endDate,
        screeningCount: orderItems.screeningCount,
        deliveryStatus: orderItems.deliveryStatus,
        deliveryNotes: orderItems.deliveryNotes,
        labOrderNumber: orderItems.labOrderNumber,
        deliveredAt: orderItems.deliveredAt,
        orderNumber: orders.orderNumber,
        paidAt: orders.paidAt,
        filmTitle: sql<string>`(
          SELECT title FROM films WHERE films.id = ${orderItems.filmId}
        )`.as("film_title"),
        cinemaName: sql<string>`(
          SELECT name FROM cinemas WHERE cinemas.id = ${orderItems.cinemaId}
        )`.as("cinema_name"),
        roomName: sql<string>`(
          SELECT name FROM rooms WHERE rooms.id = ${orderItems.roomId}
        )`.as("room_name"),
        rightsHolderName: sql<string>`(
          SELECT ${accounts.companyName} FROM ${accounts}
          WHERE ${accounts.id} = ${orderItems.rightsHolderAccountId}
        )`.as("rights_holder_name"),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .where(where),
  ]);

  const deliveries: AdminDeliveryRow[] = rows.map((r) => {
    let urgencyDays: number | null = null;
    if (r.startDate) {
      const start = new Date(r.startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      urgencyDays = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      orderItemId: r.orderItemId,
      orderNumber: r.orderNumber,
      orderId: r.orderId,
      filmTitle: r.filmTitle ?? "Unknown",
      filmId: r.filmId,
      cinemaName: r.cinemaName ?? "Unknown",
      roomName: r.roomName ?? "Unknown",
      rightsHolderName: r.rightsHolderName ?? "Unknown",
      startDate: r.startDate,
      endDate: r.endDate,
      screeningCount: r.screeningCount,
      deliveryStatus: r.deliveryStatus as DeliveryStatus,
      deliveryNotes: r.deliveryNotes,
      labOrderNumber: r.labOrderNumber,
      deliveredAt: r.deliveredAt,
      paidAt: r.paidAt,
      urgencyDays,
    };
  });

  return { deliveries, total: Number(countRow?.total ?? 0) };
}

// ─── Update delivery status ──────────────────────────────────────────────────

export async function updateDeliveryStatus(
  orderItemId: string,
  params: {
    status: DeliveryStatus;
    notes?: string;
    labOrderNumber?: string;
    adminUserId: string;
  }
): Promise<{ success: true } | { error: string }> {
  const item = await db.query.orderItems.findFirst({
    where: eq(orderItems.id, orderItemId),
  });

  if (!item) return { error: "ITEM_NOT_FOUND" };

  const oldStatus = item.deliveryStatus as DeliveryStatus;
  if (!isValidTransition(oldStatus, params.status)) {
    return { error: "INVALID_TRANSITION" };
  }

  // Verify the parent order is not refunded
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, item.orderId),
  });
  if (!order || order.status === "refunded") {
    return { error: "ORDER_REFUNDED" };
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    // Update the item
    await tx
      .update(orderItems)
      .set({
        deliveryStatus: params.status,
        ...(params.notes !== undefined && { deliveryNotes: params.notes }),
        ...(params.labOrderNumber !== undefined && { labOrderNumber: params.labOrderNumber }),
        deliveredAt: params.status === "delivered" ? now : null,
      })
      .where(eq(orderItems.id, orderItemId));

    // Transition orders.status based on item statuses
    if (params.status === "in_progress" && order.status === "paid") {
      await tx
        .update(orders)
        .set({ status: "processing", updatedAt: now })
        .where(eq(orders.id, item.orderId));
    }

    if (params.status === "delivered") {
      // Check if all items are now delivered
      const allItems = await tx.query.orderItems.findMany({
        where: eq(orderItems.orderId, item.orderId),
        columns: { id: true, deliveryStatus: true },
      });
      const allDelivered = allItems.every(
        (i) => i.id === orderItemId || i.deliveryStatus === "delivered"
      );
      if (allDelivered) {
        await tx
          .update(orders)
          .set({ status: "delivered", updatedAt: now })
          .where(eq(orders.id, item.orderId));
      } else if (order.status === "paid") {
        // At least one item is now in_progress/delivered → processing
        await tx
          .update(orders)
          .set({ status: "processing", updatedAt: now })
          .where(eq(orders.id, item.orderId));
      }
    }

    // If rolling back from in_progress to pending, check if order should revert
    if (params.status === "pending" && oldStatus === "in_progress") {
      const allItems = await tx.query.orderItems.findMany({
        where: eq(orderItems.orderId, item.orderId),
        columns: { id: true, deliveryStatus: true },
      });
      const allPending = allItems.every(
        (i) => i.id === orderItemId || i.deliveryStatus === "pending"
      );
      if (allPending && order.status === "processing") {
        await tx
          .update(orders)
          .set({ status: "paid", updatedAt: now })
          .where(eq(orders.id, item.orderId));
      }
    }

    // Audit log
    await tx.insert(auditLogs).values({
      action: "delivery.status_changed",
      entityType: "order_item",
      entityId: orderItemId,
      performedById: params.adminUserId,
      metadata: JSON.stringify({
        orderItemId,
        orderId: item.orderId,
        oldStatus,
        newStatus: params.status,
        notes: params.notes ?? null,
        labOrderNumber: params.labOrderNumber ?? null,
      }),
    });
  });

  return { success: true };
}

// ─── Update delivery notes only ───────────────────────────────────────────────

export async function updateDeliveryNotes(
  orderItemId: string,
  params: {
    notes: string;
    labOrderNumber?: string;
    adminUserId: string;
  }
): Promise<{ success: true } | { error: string }> {
  const item = await db.query.orderItems.findFirst({
    where: eq(orderItems.id, orderItemId),
    columns: { id: true, orderId: true },
  });

  if (!item) return { error: "ITEM_NOT_FOUND" };

  await db
    .update(orderItems)
    .set({
      deliveryNotes: params.notes,
      ...(params.labOrderNumber !== undefined && { labOrderNumber: params.labOrderNumber }),
    })
    .where(eq(orderItems.id, orderItemId));

  // Audit log
  await db.insert(auditLogs).values({
    action: "delivery.notes_updated",
    entityType: "order_item",
    entityId: orderItemId,
    performedById: params.adminUserId,
    metadata: JSON.stringify({
      orderItemId,
      orderId: item.orderId,
      notes: params.notes,
      labOrderNumber: params.labOrderNumber ?? null,
    }),
  });

  return { success: true };
}

// ─── Get delivery item context for emails ─────────────────────────────────────

export async function getDeliveryEmailContext(orderItemId: string) {
  const item = await db.query.orderItems.findFirst({
    where: eq(orderItems.id, orderItemId),
    with: {
      order: {
        columns: { id: true, orderNumber: true, exhibitorAccountId: true },
      },
      film: { columns: { title: true } },
      cinema: { columns: { name: true } },
      room: { columns: { name: true } },
    },
  });

  if (!item) return null;

  return {
    filmTitle: item.film?.title ?? "Unknown",
    cinemaName: item.cinema?.name ?? "Unknown",
    roomName: item.room?.name ?? "Unknown",
    orderNumber: item.order.orderNumber,
    exhibitorAccountId: item.order.exhibitorAccountId,
    deliveryNotes: item.deliveryNotes,
    deliveredAt: item.deliveredAt,
  };
}
