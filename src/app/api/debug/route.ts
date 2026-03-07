import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

/**
 * Temporary diagnostic endpoint — remove after production DB issue is resolved.
 * Tests the DB connection and returns the exact error for debugging.
 */
export async function GET() {
  const env = {
    NODE_ENV: process.env.NODE_ENV,
    DB_URL_SET: !!process.env.DATABASE_URL,
    DB_URL_PREFIX: process.env.DATABASE_URL?.substring(0, 30) + "…",
    SMTP_HOST: process.env.SMTP_HOST ?? "(not set)",
  };

  try {
    const result = await db.execute(sql`SELECT version() as version, now() as now`);
    const rows = result as unknown as Array<Record<string, unknown>>;
    return Response.json({ status: "ok", env, row: rows[0] });
  } catch (err) {
    const error = err as Error & { code?: string; errno?: string };
    console.error("[debug] DB connection failed:", err);
    return Response.json(
      {
        status: "db_error",
        env,
        message: error.message,
        code: error.code,
        errno: error.errno,
        stack: error.stack?.split("\n").slice(0, 5),
      },
      { status: 500 }
    );
  }
}
