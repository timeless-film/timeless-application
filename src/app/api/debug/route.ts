import postgres from "postgres";

/**
 * Temporary diagnostic endpoint — remove after production DB issue is resolved.
 * Tests the DB connection directly (bypasses Drizzle) to capture the raw error.
 */
export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const env = {
    NODE_ENV: process.env.NODE_ENV,
    DB_URL_PREFIX: dbUrl.substring(0, 35) + "…",
    SMTP_HOST: process.env.SMTP_HOST ?? "(not set)",
  };

  // Test 1: raw connection without SSL
  let rawResult: string | null = null;
  let rawError: string | null = null;
  try {
    const sql = postgres(dbUrl, { max: 1, connect_timeout: 5, ssl: false });
    const res = await sql`SELECT 1 as ok`;
    rawResult = JSON.stringify(res);
    await sql.end();
  } catch (err) {
    rawError =
      err instanceof Error
        ? `${err.message} [${(err as NodeJS.ErrnoException).code ?? ""}]`
        : String(err);
  }

  // Test 2: connection with ssl: "require"
  let sslResult: string | null = null;
  let sslError: string | null = null;
  try {
    const sql = postgres(dbUrl, { max: 1, connect_timeout: 5, ssl: "require" });
    const res = await sql`SELECT version()`;
    sslResult = String(res[0]?.version).substring(0, 60);
    await sql.end();
  } catch (err) {
    const e = err as Error & { code?: string; cause?: unknown };
    const cause = e.cause instanceof Error ? e.cause.message : String(e.cause ?? "");
    sslError = `${e.message} [code=${e.code ?? ""}] [cause=${cause}]`;
  }

  return Response.json(
    {
      env,
      rawNoSSL: { result: rawResult, error: rawError },
      sslRequire: { result: sslResult, error: sslError },
    },
    { status: sslResult ? 200 : 500 }
  );
}
