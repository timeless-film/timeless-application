import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { verifyApiAuth } from "@/lib/auth/api-auth";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { getFilmForExhibitor } from "@/lib/services/catalog-service";

import type { NextRequest } from "next/server";

// ─── GET /api/v1/catalog/[filmId] ────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filmId: string }> }
) {
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
        {
          error: {
            code: "FORBIDDEN",
            message: "Only exhibitor accounts can access the catalog",
          },
        },
        { status: 403 }
      );
    }

    const { filmId } = await params;

    // Fetch film
    const film = await getFilmForExhibitor(filmId, authResult.accountId);

    if (!film) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Film not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: film }, { status: 200 });
  } catch (error) {
    console.error("Error fetching film:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
