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
  updateAccountCommissionRate,
} from "@/lib/services/admin-accounts-service";

interface ListRightsHoldersInput {
  search?: string;
  status?: "active" | "suspended";
  page: number;
  limit: number;
}

export async function getRightsHoldersPaginated(input: ListRightsHoldersInput) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  const result = await listAccountsForAdmin({
    type: "rights_holder",
    page: input.page,
    limit: input.limit,
    search: input.search,
    status: input.status,
  });

  return { accounts: result.accounts, total: result.total };
}

export async function getAccountDetailAction(accountId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  const detail = await getAccountDetail(accountId);
  if (!detail) return { error: "NOT_FOUND" as const };

  const [accountOrders, accountRequests, salesTotals] = await Promise.all([
    getOrdersForAccount(accountId, "rights_holder"),
    getRequestsForAccount(accountId, "rights_holder"),
    getAccountSalesTotals(accountId, "rights_holder"),
  ]);

  return { data: { ...detail, orders: accountOrders, requests: accountRequests, salesTotals } };
}

export async function suspendRightsHolderAction(accountId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  try {
    await suspendAccount(accountId, ctx.session.user.id);
    return { success: true as const };
  } catch (error) {
    console.error("Failed to suspend account:", error);
    return { error: "SUSPEND_FAILED" as const };
  }
}

export async function reactivateRightsHolderAction(accountId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  try {
    await reactivateAccount(accountId, ctx.session.user.id);
    return { success: true as const };
  } catch (error) {
    console.error("Failed to reactivate account:", error);
    return { error: "REACTIVATE_FAILED" as const };
  }
}

export async function updateCommissionRateAction(accountId: string, rate: number | null) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  if (rate !== null && (rate < 0 || rate > 100)) {
    return { error: "INVALID_COMMISSION_RATE" as const };
  }

  try {
    // Convert percentage to decimal string or null for default
    const rateString = rate !== null ? (rate / 100).toFixed(4) : null;
    await updateAccountCommissionRate(accountId, rateString, ctx.session.user.id);
    return { success: true as const };
  } catch (error) {
    console.error("Failed to update commission rate:", error);
    return { error: "UPDATE_FAILED" as const };
  }
}
