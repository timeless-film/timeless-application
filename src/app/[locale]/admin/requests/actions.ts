"use server";

import { getCurrentMembership } from "@/lib/auth/membership";
import { getPlatformPricingSettings } from "@/lib/pricing";
import {
  adminCancelRequest,
  forceApproveRequest,
  forceRejectRequest,
  getRequestDetailForAdmin,
  listRequestsForAdmin,
} from "@/lib/services/admin-requests-service";

import type { RequestStatus } from "@/lib/services/request-service";

interface ListRequestsInput {
  search?: string;
  status?: RequestStatus;
  page: number;
  limit: number;
}

export async function getRequestsPaginated(input: ListRequestsInput) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  const settings = await getPlatformPricingSettings();
  const urgencyDays = settings.requestUrgencyDaysBeforeStart;

  const result = await listRequestsForAdmin(
    {
      page: input.page,
      limit: input.limit,
      search: input.search,
      status: input.status,
    },
    urgencyDays
  );

  return { requests: result.requests, total: result.total };
}

export async function getRequestDetailAction(requestId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  const detail = await getRequestDetailForAdmin(requestId);
  if (!detail) return { error: "NOT_FOUND" as const };

  return { data: detail };
}

export async function forceApproveRequestAction(requestId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  try {
    const result = await forceApproveRequest(requestId, ctx.session.user.id);
    if ("error" in result) {
      return { error: result.error };
    }
    return { success: true as const };
  } catch (error) {
    console.error("Failed to force approve request:", error);
    return { error: "APPROVE_FAILED" as const };
  }
}

export async function forceRejectRequestAction(requestId: string, reason?: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  try {
    const result = await forceRejectRequest(requestId, ctx.session.user.id, reason);
    if ("error" in result) {
      return { error: result.error };
    }
    return { success: true as const };
  } catch (error) {
    console.error("Failed to force reject request:", error);
    return { error: "REJECT_FAILED" as const };
  }
}

export async function adminCancelRequestAction(requestId: string, reason?: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  try {
    const result = await adminCancelRequest(requestId, ctx.session.user.id, reason);
    if ("error" in result) {
      return { error: result.error };
    }
    return { success: true as const };
  } catch (error) {
    console.error("Failed to cancel request:", error);
    return { error: "CANCEL_FAILED" as const };
  }
}
