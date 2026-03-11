import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { getOrdersForExhibitor } from "@/lib/services/order-service";

import type { NextRequest } from "next/server";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["paid", "processing", "delivered", "refunded"]).optional(),
});

/**
 * GET /api/v1/orders
 * List orders for the authenticated exhibitor account (paginated).
 */
export async function GET(request: NextRequest) {
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

  // Parse query params
  const rawParams: Record<string, string> = {};
  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    rawParams[key] = value;
  }

  const parsed = querySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "Invalid query parameters",
          details: parsed.error.issues,
        },
      },
      { status: 400 }
    );
  }

  const { page, limit, status } = parsed.data;

  const result = await getOrdersForExhibitor({
    exhibitorAccountId: authResult.accountId,
    page,
    limit,
    status,
  });

  return NextResponse.json({
    data: result.data,
    pagination: result.pagination,
  });
}
