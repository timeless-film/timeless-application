"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getActiveAccountCookie } from "@/lib/auth/membership";
import {
  cancelRequestForAccount,
  listRequestsForAccount,
  relaunchRequestForAccount,
  removeCartItemForAccount,
} from "@/lib/services/booking-service";
import {
  getCartSummary,
  getCartItemCount as getCartItemCountService,
} from "@/lib/services/cart-service";
import {
  createCheckoutSession,
  createRequestCheckoutSession,
  recalculateCartPricing,
} from "@/lib/services/checkout-service";
import { convertCurrency } from "@/lib/services/exchange-rate-service";
import { getOrderDetail, getOrdersForExhibitor } from "@/lib/services/order-service";
import { getExhibitorPreferredCurrency } from "@/lib/services/request-service";
import { stripe } from "@/lib/stripe";

const listRequestsSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "approved", "rejected", "cancelled", "paid"]).optional(),
  tab: z.enum(["pending", "history"]).optional(),
  search: z.string().max(200).optional(),
});

const checkoutSchema = z.object({
  recalculate: z.boolean().optional(),
  locale: z.string().min(2).max(5).optional(),
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

  const summary = await getCartSummary({ exhibitorAccountId: authResult.accountId });
  return { success: true as const, data: summary };
}

export async function getCartCount(): Promise<number> {
  const authResult = await getAuthenticatedAccountId();
  if ("error" in authResult) return 0;

  return getCartItemCountService({ exhibitorAccountId: authResult.accountId });
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

  // Create Stripe Checkout Session
  const h = await headers();
  const origin =
    h.get("origin") ||
    h.get("referer")?.replace(/\/[^/]*$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const appUrl = origin.replace(/\/$/, "");
  const locale = parsed.data.locale || "en";

  const result = await createCheckoutSession({
    exhibitorAccountId: authResult.accountId,
    appUrl,
    locale,
  });

  if (!result.success) {
    return {
      error: result.error || "STRIPE_ERROR",
      errorDetails: result.errorDetails,
    };
  }

  return {
    success: true as const,
    redirectUrl: result.redirectUrl!,
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

  const [result, preferredCurrency] = await Promise.all([
    listRequestsForAccount({
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
    }),
    getExhibitorPreferredCurrency(authResult.accountId),
  ]);

  // For requests whose currency differs from preferred, compute a live converted total
  const dataWithConversion = await Promise.all(
    result.data.map(async (request) => {
      if (request.currency === preferredCurrency) {
        return { ...request, convertedTotal: null, convertedCurrency: null };
      }
      const convertedDisplayedPrice = await convertCurrency(
        request.displayedPrice * request.screeningCount,
        request.currency,
        preferredCurrency
      );
      return {
        ...request,
        convertedTotal: convertedDisplayedPrice,
        convertedCurrency: preferredCurrency,
      };
    })
  );

  return {
    success: true as const,
    data: dataWithConversion,
    pagination: result.pagination,
    preferredCurrency,
  };
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

export async function getOrders(params?: {
  page?: number;
  limit?: number;
  status?: "paid" | "processing" | "delivered" | "refunded";
}) {
  const authResult = await getAuthenticatedAccountId();
  if ("error" in authResult) {
    return authResult;
  }

  const page = params?.page && params.page > 0 ? params.page : 1;
  const limit = params?.limit && params.limit > 0 ? Math.min(params.limit, 100) : 20;

  const result = await getOrdersForExhibitor({
    exhibitorAccountId: authResult.accountId,
    page,
    limit,
    status: params?.status,
  });

  return { success: true as const, ...result };
}

export async function getOrder(orderId: string) {
  const authResult = await getAuthenticatedAccountId();
  if ("error" in authResult) {
    return authResult;
  }

  const order = await getOrderDetail({
    orderId,
    exhibitorAccountId: authResult.accountId,
  });

  if (!order) {
    return { error: "ORDER_NOT_FOUND" as const };
  }

  return { success: true as const, data: order };
}

export async function payRequest(input: { requestId: string; locale?: string }) {
  const authResult = await getAuthenticatedAccountId();
  if ("error" in authResult) {
    return authResult;
  }

  const requestId = z.string().uuid().safeParse(input.requestId);
  if (!requestId.success) {
    return { error: "INVALID_INPUT" as const };
  }

  const h = await headers();
  const origin =
    h.get("origin") ||
    h.get("referer")?.replace(/\/[^/]*$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const appUrl = origin.replace(/\/$/, "");
  const locale = input.locale || "en";

  const result = await createRequestCheckoutSession({
    requestId: requestId.data,
    exhibitorAccountId: authResult.accountId,
    appUrl,
    locale,
  });

  if (!result.success) {
    return {
      error: result.error || ("STRIPE_ERROR" as const),
      errorDetails: result.errorDetails,
    };
  }

  return {
    success: true as const,
    redirectUrl: result.redirectUrl!,
  };
}

export async function getOrderInvoiceUrl(orderId: string) {
  const authResult = await getAuthenticatedAccountId();
  if ("error" in authResult) {
    return authResult;
  }

  const order = await getOrderDetail({
    orderId,
    exhibitorAccountId: authResult.accountId,
  });

  if (!order) {
    return { error: "ORDER_NOT_FOUND" as const };
  }

  if (!order.stripeInvoiceId) {
    return { error: "INVOICE_NOT_AVAILABLE" as const };
  }

  try {
    const invoice = await stripe.invoices.retrieve(order.stripeInvoiceId);

    if (!invoice.invoice_pdf) {
      return { error: "INVOICE_NOT_AVAILABLE" as const };
    }

    return {
      success: true as const,
      invoiceUrl: invoice.invoice_pdf,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
    };
  } catch (error) {
    console.error("Failed to retrieve Stripe invoice:", error);
    return { error: "STRIPE_ERROR" as const };
  }
}
