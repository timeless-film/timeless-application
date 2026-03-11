import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerToken } from "@/lib/auth/api-auth";
import { cancelRequest } from "@/lib/services/request-service";

import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{ requestId: string }>;
}

const cancelSchema = z.object({
  reason: z.string().max(1000).optional(),
});

/**
 * POST /api/v1/requests/:requestId/cancel
 * Cancel a pending request (exhibitor action).
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
    const body = await request.json().catch(() => ({}));
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Invalid request body" } },
        { status: 400 }
      );
    }

    const result = await cancelRequest({
      requestId: idResult.data,
      exhibitorAccountId: authResult.accountId,
      reason: parsed.data.reason,
    });

    if (!result.success) {
      const statusMap: Record<string, number> = {
        REQUEST_NOT_FOUND: 404,
        INVALID_TRANSITION: 409,
        UNAUTHORIZED: 403,
      };
      return NextResponse.json(
        { error: { code: result.error, message: `Cannot cancel request: ${result.error}` } },
        { status: statusMap[result.error] ?? 400 }
      );
    }

    return NextResponse.json({ data: { id: requestId, status: "cancelled" } });
  } catch (error) {
    console.error("Error cancelling request:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Server error" } },
      { status: 500 }
    );
  }
}
