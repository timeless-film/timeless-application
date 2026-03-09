import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getActiveAccountCookie } from "@/lib/auth/membership";
import { db } from "@/lib/db";
import { cartItems } from "@/lib/db/schema";

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

    const items = await db.query.cartItems.findMany({
      where: eq(cartItems.exhibitorAccountId, activeAccount.accountId),
      columns: { id: true },
    });

    return Response.json({ count: items.length });
  } catch (error) {
    console.error("Failed to get cart count:", error);
    return Response.json({ count: 0 });
  }
}
