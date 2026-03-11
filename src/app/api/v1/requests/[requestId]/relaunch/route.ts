import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { relaunchRequestForAccount } from "@/lib/services/booking-service";

import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{ requestId: string }>;
}

/**
 * POST /api/v1/requests/:requestId/relaunch
 * Relaunch a cancelled or rejected request (exhibitor action).
 * Creates a new pending request copying the original data.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const authResult = await verifyBearerToken(request);
  if (!authResult.success) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing token" } },
      { status: 401 }
    );
  }

  const { requestId } = await params;
  const idResult = z.string().uuid().safeParse(requestId);
  if (!idResult.success) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Invalid request ID" } },
      { status: 400 }
    );
  }

  try {
    const result = await relaunchRequestForAccount({
      requestId: idResult.data,
      exhibitorAccountId: authResult.accountId,
    });

    if (!result) {
      return NextResponse.json(
        {
          error: {
            code: "CANNOT_RELAUNCH",
            message: "Request not found or cannot be relaunched (must be cancelled or rejected)",
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ data: { id: result.id, status: result.status } }, { status: 201 });
  } catch (error) {
    console.error("Error relaunching request:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Server error" } },
      { status: 500 }
    );
  }
}
