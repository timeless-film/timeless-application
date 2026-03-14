"use server";

import { getCurrentMembership } from "@/lib/auth/membership";
import {
  getOrderDetailForAdmin,
  listOrdersForAdmin,
  refundOrder,
} from "@/lib/services/admin-orders-service";

type OrderStatus = "paid" | "processing" | "delivered" | "refunded";

interface ListOrdersInput {
  search?: string;
  status?: OrderStatus;
  page: number;
  limit: number;
}

export async function getOrdersPaginated(input: ListOrdersInput) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  const result = await listOrdersForAdmin({
    page: input.page,
    limit: input.limit,
    search: input.search,
    status: input.status,
  });

  return { orders: result.orders, total: result.total };
}

export async function getOrderDetailAction(orderId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  const detail = await getOrderDetailForAdmin(orderId);
  if (!detail) return { error: "NOT_FOUND" as const };

  return { data: detail };
}

export async function refundOrderAction(orderId: string, reason: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  if (!reason.trim()) return { error: "REASON_REQUIRED" as const };

  try {
    const result = await refundOrder(orderId, ctx.session.user.id, reason.trim());
    if ("error" in result) return { error: result.error };
    return { success: true as const };
  } catch (error) {
    console.error("Failed to refund order:", error);
    return { error: "REFUND_FAILED" as const };
  }
}
