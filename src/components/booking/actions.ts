"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getActiveAccountCookie } from "@/lib/auth/membership";
import {
  cancelRequestForAccount,
  listCartItemsForAccount,
  listOrdersForAccount,
  listRequestsForAccount,
  relaunchRequestForAccount,
  removeCartItemForAccount,
} from "@/lib/services/booking-service";
import { validateCheckout, recalculateCartPricing } from "@/lib/services/checkout-service";

const listRequestsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "approved", "rejected", "cancelled", "paid"]).optional(),
  tab: z.enum(["pending", "history"]).optional(),
  search: z.string().max(200).optional(),
});

const checkoutSchema = z.object({
  recalculate: z.boolean().optional(),
});

async function getAuthenticatedAccountId() {
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

export async function getCartItems() {
  const authResult = await getAuthenticatedAccountId();
  if ("error" in authResult) {
    return authResult;
  }

  const items = await listCartItemsForAccount(authResult.accountId);
  return { success: true as const, data: items };
}

export async function removeCartItem(cartItemId: string) {
  const authResult = await getAuthenticatedAccountId();
  if ("error" in authResult) {
    return authResult;
  }

  const removed = await removeCartItemForAccount({
    exhibitorAccountId: authResult.accountId,
    cartItemId,
  });

  if (!removed) {
    return { error: "NOT_FOUND" as const };
  }

  return { success: true as const };
}

export async function checkoutCart(input: z.infer<typeof checkoutSchema>) {
  const authResult = await getAuthenticatedAccountId();
  if ("error" in authResult) {
    return authResult;
  }

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "INVALID_INPUT" as const };
  }

  // If user requested recalculation, return updated pricing
  if (parsed.data.recalculate) {
    const recalcResult = await recalculateCartPricing({
      exhibitorAccountId: authResult.accountId,
    });

    if (!recalcResult.success) {
      return {
        error: recalcResult.error || "DATABASE_ERROR",
        errorDetails: recalcResult.errorDetails,
      };
    }

    return {
      success: true as const,
      recalculated: true as const,
      items: recalcResult.items,
    };
  }

  // Validate checkout preconditions
  const validation = await validateCheckout({
    exhibitorAccountId: authResult.accountId,
  });

  if (!validation.success) {
    // Map checkout errors to action errors
    const errorCode = validation.error || "DATABASE_ERROR";
    return {
      error: errorCode,
      errorDetails: validation.errorDetails,
    };
  }

  // E06 stub: payment implementation in E08
  // After E08, this will create Stripe Checkout Session
  return {
    error: "PAYMENT_NOT_AVAILABLE_YET" as const,
    canRecalculate: true as const,
  };
}

export async function getRequests(input: z.infer<typeof listRequestsSchema>) {
  const authResult = await getAuthenticatedAccountId();
  if ("error" in authResult) {
    return authResult;
  }

  const parsed = listRequestsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "INVALID_INPUT" as const };
  }

  const result = await listRequestsForAccount({
    exhibitorAccountId: authResult.accountId,
    status: parsed.data.status,
    statuses:
      parsed.data.tab === "pending"
        ? ["pending", "approved"]
        : parsed.data.tab === "history"
          ? ["rejected", "cancelled", "paid"]
          : undefined,
    search: parsed.data.search?.trim() || undefined,
    page: parsed.data.page,
    limit: parsed.data.limit,
  });

  return { success: true as const, ...result };
}

export async function cancelRequest(requestId: string) {
  const authResult = await getAuthenticatedAccountId();
  if ("error" in authResult) {
    return authResult;
  }

  const cancelled = await cancelRequestForAccount({
    exhibitorAccountId: authResult.accountId,
    requestId,
  });

  if (!cancelled) {
    return { error: "REQUEST_NOT_CANCELLABLE" as const };
  }

  return { success: true as const };
}

export async function relaunchRequest(requestId: string) {
  const authResult = await getAuthenticatedAccountId();
  if ("error" in authResult) {
    return authResult;
  }

  const relaunched = await relaunchRequestForAccount({
    exhibitorAccountId: authResult.accountId,
    requestId,
    userId: authResult.userId,
  });

  if (!relaunched) {
    return { error: "REQUEST_NOT_RELAUNCHABLE" as const };
  }

  return { success: true as const, requestId: relaunched.id };
}

export async function getOrders(params?: { page?: number; limit?: number }) {
  const authResult = await getAuthenticatedAccountId();
  if ("error" in authResult) {
    return authResult;
  }

  const page = params?.page && params.page > 0 ? params.page : 1;
  const limit = params?.limit && params.limit > 0 ? Math.min(params.limit, 100) : 20;

  const result = await listOrdersForAccount({
    exhibitorAccountId: authResult.accountId,
    page,
    limit,
  });

  return { success: true as const, ...result };
}
