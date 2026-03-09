import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyApiAuth } from "@/lib/auth/api-auth";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { getCatalogForExhibitor } from "@/lib/services/catalog-service";

import type { NextRequest } from "next/server";

// ─── Validation Schema ────────────────────────────────────────────────────────

const catalogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
  sort: z.enum(["title", "releaseYear", "price"]).optional().default("title"),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
  search: z.string().optional(),
  directors: z.union([z.string(), z.array(z.string())]).optional(),
  cast: z.union([z.string(), z.array(z.string())]).optional(),
  genres: z.union([z.string(), z.array(z.string())]).optional(),
  countries: z.union([z.string(), z.array(z.string())]).optional(),
  rightsHolderIds: z.union([z.string(), z.array(z.string())]).optional(),
  type: z.enum(["direct", "all"]).optional().default("all"),
  yearMin: z.coerce.number().int().optional(),
  yearMax: z.coerce.number().int().optional(),
  durationMin: z.coerce.number().int().optional(),
  durationMax: z.coerce.number().int().optional(),
  availableForTerritory: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((val) => (val === "false" ? false : true))
    .optional()
    .default(true),
});

// ─── GET /api/v1/catalog ──────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // Auth check (Bearer token OR session + active account cookie)
    const authResult = await verifyApiAuth(request);
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
        { error: { code: "FORBIDDEN", message: "Only exhibitor accounts can access the catalog" } },
        { status: 403 }
      );
    }

    // Parse and validate query params
    const searchParams: Record<string, string | string[]> = {};

    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      searchParams[key] = value;
    }

    // Handle multi-select params (repeated keys)
    const multiSelectKeys = ["directors", "cast", "genres", "countries", "rightsHolderIds"];
    for (const key of multiSelectKeys) {
      const values = request.nextUrl.searchParams.getAll(key);
      if (values.length > 1) {
        searchParams[key] = values;
      }
    }

    const validationResult = catalogQuerySchema.safeParse(searchParams);
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

    // Normalize array params
    const filters = {
      search: params.search,
      directors: Array.isArray(params.directors)
        ? params.directors
        : params.directors
          ? [params.directors]
          : undefined,
      cast: Array.isArray(params.cast) ? params.cast : params.cast ? [params.cast] : undefined,
      genres: Array.isArray(params.genres)
        ? params.genres
        : params.genres
          ? [params.genres]
          : undefined,
      countries: Array.isArray(params.countries)
        ? params.countries
        : params.countries
          ? [params.countries]
          : undefined,
      rightsHolderIds: Array.isArray(params.rightsHolderIds)
        ? params.rightsHolderIds
        : params.rightsHolderIds
          ? [params.rightsHolderIds]
          : undefined,
      type: params.type,
      yearMin: params.yearMin,
      yearMax: params.yearMax,
      durationMin: params.durationMin,
      durationMax: params.durationMax,
      availableForTerritory: params.availableForTerritory,
    };

    const pagination = {
      page: params.page,
      limit: params.limit,
    };

    const sort = {
      field: params.sort,
      order: params.order,
    } as const;

    // Fetch catalog
    const result = await getCatalogForExhibitor(authResult.accountId, filters, pagination, sort);

    return NextResponse.json(
      {
        data: result.films,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching catalog:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
