/**
 * Global setup for Playwright E2E tests.
 *
 * 1. Local only: creates the `timeless_test` database if it doesn't exist.
 * 2. Local only: pushes the Drizzle schema to the test database.
 * 3. Truncates all application tables for a clean slate.
 * 4. Warms up Next.js pages to avoid cold-start timeouts.
 */
import { execSync } from "node:child_process";

import postgres from "postgres";

const BASE_URL = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? 3099}`;

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://timeless:timeless@localhost:5432/timeless_test";

const WARMUP_PATHS = [
  "/en/login",
  "/en/register",
  "/en/forgot-password",
  "/api/auth/session",
  "/en/onboarding",
  "/api/v1/cart",
  "/api/v1/cart/items",
];

/**
 * Tables to truncate before each test run, in dependency-safe order
 * (tables with foreign keys first).
 */
const TABLES_TO_TRUNCATE = [
  "search_events",
  "film_events",
  "api_tokens",
  "order_items",
  "orders",
  "cart_items",
  "requests",
  "rooms",
  "cinemas",
  "film_prices",
  "films",
  "invitations",
  "account_members",
  "better_auth_sessions",
  "better_auth_verifications",
  "better_auth_accounts",
  "accounts",
  "better_auth_users",
  "platform_settings_history",
  "audit_logs",
  "platform_settings",
];

async function ensureDatabaseExists() {
  // Parse the test DB URL to get the database name and a connection to the default 'postgres' DB
  const url = new URL(TEST_DATABASE_URL);
  const testDbName = url.pathname.slice(1); // Remove leading /

  // Connect to the default 'postgres' database to create the test DB
  url.pathname = "/postgres";
  const adminSql = postgres(url.toString(), { max: 1 });

  try {
    const result =
      await adminSql`SELECT 1 FROM pg_database WHERE datname = ${testDbName}`;
    if (result.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`[global-setup] Creating database "${testDbName}"…`);
      await adminSql.unsafe(`CREATE DATABASE "${testDbName}"`);
      // eslint-disable-next-line no-console
      console.log(`[global-setup] Database "${testDbName}" created.`);
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `[global-setup] Database "${testDbName}" already exists.`
      );
    }
  } finally {
    await adminSql.end();
  }
}

async function pushSchema() {
  // eslint-disable-next-line no-console
  console.log("[global-setup] Pushing Drizzle schema to test database…");
  execSync(`npx drizzle-kit push`, {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  });
  // eslint-disable-next-line no-console
  console.log("[global-setup] Schema push complete.");
}

async function truncateTables() {
  const sql = postgres(TEST_DATABASE_URL, { max: 1 });
  try {
    // eslint-disable-next-line no-console
    console.log("[global-setup] Truncating all tables…");
    const tableList = TABLES_TO_TRUNCATE.map((t) => `"${t}"`).join(", ");
    await sql.unsafe(`TRUNCATE TABLE ${tableList} CASCADE`);
    // eslint-disable-next-line no-console
    console.log("[global-setup] Tables truncated.");
  } finally {
    await sql.end();
  }
}

async function warmupPages() {
  // eslint-disable-next-line no-console
  console.log("[global-setup] Warming up Next.js pages…");
  for (const path of WARMUP_PATHS) {
    try {
      const response = await fetch(`${BASE_URL}${path}`);
      // eslint-disable-next-line no-console
      console.log(`[global-setup]   ${path} → ${response.status}`);
    } catch {
      // eslint-disable-next-line no-console
      console.warn(
        `[global-setup]   ${path} → failed (server might still be starting)`
      );
    }
  }
  // eslint-disable-next-line no-console
  console.log("[global-setup] Warmup complete.");
}

export default async function globalSetup() {
  if (!process.env.CI) {
    await ensureDatabaseExists();
    await pushSchema();
  }

  await truncateTables();
  await warmupPages();
}
