import { NextResponse } from "next/server";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { getCartSummary } from "@/lib/services/cart-service";

import type { NextRequest } from "next/server";

/**
 * GET /api/v1/cart
 * Returns the active cart with items and subtotals
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const summary = await getCartSummary({
    exhibitorAccountId: authResult.accountId,
  });

  return NextResponse.json({ data: summary });
}
