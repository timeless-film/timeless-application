import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { getOrderDetail } from "@/lib/services/order-service";

import type { NextRequest } from "next/server";

/**
 * GET /api/v1/orders/[orderId]
 * Returns order detail for the authenticated exhibitor.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
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
      { error: { code: "FORBIDDEN", message: "Only exhibitor accounts can access orders" } },
      { status: 403 }
    );
  }

  const { orderId } = await params;

  const order = await getOrderDetail({
    orderId,
    exhibitorAccountId: authResult.accountId,
  });

  if (!order) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Order not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ data: order });
}
