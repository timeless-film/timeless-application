import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { createCheckoutSession } from "@/lib/services/checkout-service";

import type { NextRequest } from "next/server";

/**
 * POST /api/v1/cart/checkout
 * Creates a Stripe Checkout Session for the authenticated exhibitor's cart.
 * Returns the Stripe Checkout URL for redirect.
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  // Check account type (exhibitor only)
  const [account] = await db
    .select({ type: accounts.type })
    .from(accounts)
    .where(eq(accounts.id, authResult.accountId))
    .limit(1);

  if (!account || account.type !== "exhibitor") {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Only exhibitor accounts can checkout" } },
      { status: 403 }
    );
  }

  try {
    const origin =
      request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const appUrl = origin.replace(/\/$/, "");

    // Accept optional locale from body, default to "en"
    let locale = "en";
    try {
      const body = await request.json();
      if (body.locale === "fr" || body.locale === "en") {
        locale = body.locale;
      }
    } catch {
      // Empty body is fine — default locale "en"
    }

    const result = await createCheckoutSession({
      exhibitorAccountId: authResult.accountId,
      appUrl,
      locale,
    });

    if (!result.success) {
      const statusMap: Record<string, number> = {
        CART_EMPTY: 400,
        UNAUTHORIZED: 401,
        FILM_NOT_FOUND: 404,
        FILM_NOT_AVAILABLE: 404,
        TERRITORY_NOT_AVAILABLE: 403,
        CINEMA_NOT_FOUND: 404,
        ROOM_NOT_FOUND: 404,
        PRICE_CHANGED: 409,
        INVALID_OWNERSHIP: 403,
        RIGHTS_HOLDER_NOT_ONBOARDED: 400,
        STRIPE_ERROR: 500,
      };

      const status = statusMap[result.error || "STRIPE_ERROR"] || 400;

      return NextResponse.json(
        {
          error: {
            code: result.error,
            message: result.errorDetails?.message || "Checkout failed",
          },
        },
        { status }
      );
    }

    return NextResponse.json({ data: { checkoutUrl: result.redirectUrl } }, { status: 201 });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Server error" } },
      { status: 500 }
    );
  }
}
