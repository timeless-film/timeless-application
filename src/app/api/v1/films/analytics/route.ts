import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyApiAuth } from "@/lib/auth/api-auth";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { getFilmAnalytics } from "@/lib/services/analytics-service";

import type { NextRequest } from "next/server";

// ─── Validation Schema ────────────────────────────────────────────────────────

const analyticsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sort: z.enum(["revenue", "views", "requests", "addsToCart"]).optional().default("revenue"),
  order: z.enum(["asc", "desc"]).optional().default("desc"),
  status: z.string().optional(),
  type: z.string().optional(),
  region: z.string().optional(),
  period: z.enum(["7days", "30days", "90days"]).optional().default("30days"),
});

// ─── GET /api/v1/films/analytics ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check
    const authResult = await verifyApiAuth(request);
    if (!authResult.success) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
        { status: 401 }
      );
    }

    // 2. Check account type (rights_holder only)
    const [account] = await db
      .select({ type: accounts.type })
      .from(accounts)
      .where(eq(accounts.id, authResult.accountId))
      .limit(1);

    if (!account || account.type !== "rights_holder") {
      return NextResponse.json(
        {
          error: { code: "FORBIDDEN", message: "Only rights holder accounts can access analytics" },
        },
        { status: 403 }
      );
    }

    // 3. Parse and validate query params
    const searchParams: Record<string, string> = {};
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      searchParams[key] = value;
    }

    const validationResult = analyticsQuerySchema.safeParse(searchParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PARAMS",
            message: "Invalid query parameters",
            details: validationResult.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const params = validationResult.data;

    // 4. Fetch analytics
    const result = await getFilmAnalytics(
      authResult.accountId,
      {
        status: params.status,
        type: params.type,
        region: params.region,
        period: params.period,
      },
      { page: params.page, limit: params.limit },
      { field: params.sort, order: params.order }
    );

    return NextResponse.json(
      {
        data: {
          kpis: result.kpis,
          films: result.films,
          topSearches: result.topSearches,
          topFilters: result.topFilters,
          timeline: result.timeline,
        },
        pagination: result.pagination,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching film analytics:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
