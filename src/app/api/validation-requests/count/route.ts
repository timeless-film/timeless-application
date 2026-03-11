import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getActiveAccountCookie } from "@/lib/auth/membership";
import { db } from "@/lib/db";
import { requests } from "@/lib/db/schema";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Response.json({ count: 0 });
    }

    const activeAccount = await getActiveAccountCookie();
    if (!activeAccount?.accountId) {
      return Response.json({ count: 0 });
    }

    const pendingRequests = await db.query.requests.findMany({
      where: and(
        eq(requests.rightsHolderAccountId, activeAccount.accountId),
        eq(requests.status, "pending")
      ),
      columns: { id: true },
    });

    return Response.json({ count: pendingRequests.length });
  } catch (error) {
    console.error("Failed to get pending requests count:", error);
    return Response.json({ count: 0 });
  }
}
