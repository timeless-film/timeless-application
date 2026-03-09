import { NextResponse } from "next/server";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { getRequestsSummaryForFilm } from "@/lib/services/request-service";

import type { NextRequest } from "next/server";

/**
 * GET /api/v1/films/:filmId/requests-summary
 * Returns pending and approved requests for the film (anti-duplicate awareness)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filmId: string }> }
) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { filmId } = await params;

  const summary = await getRequestsSummaryForFilm({
    filmId,
    exhibitorAccountId: authResult.accountId,
  });

  return NextResponse.json({ data: summary });
}
