"use server";

import { getCurrentMembership } from "@/lib/auth/membership";
import {
  getAccountDetail,
  getAccountSalesTotals,
  getOrdersForAccount,
  getRequestsForAccount,
  listAccountsForAdmin,
  reactivateAccount,
  suspendAccount,
} from "@/lib/services/admin-accounts-service";

interface ListExhibitorsInput {
  search?: string;
  status?: "active" | "suspended";
  page: number;
  limit: number;
}

export async function getExhibitorsPaginated(input: ListExhibitorsInput) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  const result = await listAccountsForAdmin({
    type: "exhibitor",
    page: input.page,
    limit: input.limit,
    search: input.search,
    status: input.status,
  });

  return { accounts: result.accounts, total: result.total };
}

export async function getExhibitorDetailAction(accountId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  const detail = await getAccountDetail(accountId);
  if (!detail) return { error: "NOT_FOUND" as const };

  const [accountOrders, accountRequests, salesTotals] = await Promise.all([
    getOrdersForAccount(accountId, "exhibitor"),
    getRequestsForAccount(accountId, "exhibitor"),
    getAccountSalesTotals(accountId, "exhibitor"),
  ]);

  return { data: { ...detail, orders: accountOrders, requests: accountRequests, salesTotals } };
}

export async function suspendExhibitorAction(accountId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  try {
    await suspendAccount(accountId, ctx.session.user.id);
    return { success: true as const };
  } catch (error) {
    console.error("Failed to suspend exhibitor account:", error);
    return { error: "SUSPEND_FAILED" as const };
  }
}

export async function reactivateExhibitorAction(accountId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  try {
    await reactivateAccount(accountId, ctx.session.user.id);
    return { success: true as const };
  } catch (error) {
    console.error("Failed to reactivate exhibitor account:", error);
    return { error: "REACTIVATE_FAILED" as const };
  }
}
