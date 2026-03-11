import { NextResponse } from "next/server";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { listIncomingRequestsForRightsHolder } from "@/lib/services/booking-service";

import type { NextRequest } from "next/server";

/**
 * GET /api/v1/requests/incoming
 * List incoming requests for the authenticated rights holder account.
 * Returns pending requests by default; use ?status= to filter.
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
  const statusParam = searchParams.get("status") as
    | "pending"
    | "approved"
    | "rejected"
    | "cancelled"
    | "paid"
    | null;
  const filmId = searchParams.get("filmId") ?? undefined;

  const result = await listIncomingRequestsForRightsHolder({
    rightsHolderAccountId: authResult.accountId,
    status: statusParam ?? undefined,
    filmId,
    page,
    limit,
  });

  return NextResponse.json(result);
}
