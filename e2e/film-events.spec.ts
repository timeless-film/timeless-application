import { createHash, randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";
import postgres from "postgres";

import { createAdminContext, loginAsAdmin } from "./helpers/admin";
import {
  createRightsHolderContext,
  loginAsRightsHolder,
} from "./helpers/rights-holder";

/**
 * Film Event Tracking E2E Tests
 *
 * Verifies that:
 * 1. Viewing a film detail page tracks a "view" event in the DB
 * 2. Adding a film to cart tracks a "cart_add" event in the DB
 * 3. RH film detail page shows analytics KPIs and chart when events exist
 * 4. Admin film detail page shows analytics KPIs and chart when events exist
 */

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://timeless:timeless@localhost:5432/timeless_test";
const BASE_URL = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? 3099}`;

const TEST_ID = Date.now().toString(36);

test.describe("Film Event Tracking", () => {
  let dbSql: ReturnType<typeof postgres>;

  let rhCtx: Awaited<ReturnType<typeof createRightsHolderContext>>;
  let adminCtx: Awaited<ReturnType<typeof createAdminContext>>;

  let exhibitorUserId: string;
  let exhibitorAccountId: string;
  let exhibitorEmail: string;
  const exhibitorPassword = "StrongPass123!";

  let filmId: string;
  let cinemaId: string;
  let roomId: string;

  test.beforeAll(async ({ request }) => {
    dbSql = postgres(DATABASE_URL, { max: 1 });

    // ── Ensure platform_settings row exists (avoids race condition on auto-create) ──
    await dbSql`
      INSERT INTO platform_settings (id)
      VALUES ('global')
      ON CONFLICT (id) DO NOTHING
    `;

    // ── Rights holder context ──
    rhCtx = await createRightsHolderContext(request, TEST_ID, "evt-rh");

    // ── Admin context ──
    adminCtx = await createAdminContext(request, TEST_ID, "evt-admin");

    // ── Exhibitor account (with user for UI login) ──
    const suffix = randomBytes(4).toString("hex");
    exhibitorEmail = `evt-exh-${TEST_ID}-${suffix}@e2e-test.local`;

    const signupRes = await request.post("/api/auth/sign-up/email", {
      data: { name: "Evt Exhibitor", email: exhibitorEmail, password: exhibitorPassword },
      headers: { "Content-Type": "application/json" },
    });
    expect(signupRes.ok()).toBeTruthy();

    await dbSql`UPDATE better_auth_users SET email_verified = true WHERE email = ${exhibitorEmail}`;

    const [user] = await dbSql`SELECT id FROM better_auth_users WHERE email = ${exhibitorEmail}`;
    if (!user) throw new Error("Failed to retrieve exhibitor user");
    exhibitorUserId = user.id;

    const [account] = await dbSql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('exhibitor', ${`EvtExh ${TEST_ID}`}, 'FR', true)
      RETURNING id
    `;
    if (!account) throw new Error("Failed to create exhibitor account");
    exhibitorAccountId = account.id;

    await dbSql`
      INSERT INTO account_members (account_id, user_id, role)
      VALUES (${exhibitorAccountId}, ${exhibitorUserId}, 'owner')
    `;

    // ── Cinema + Room ──
    const [cinema] = await dbSql`
      INSERT INTO cinemas (account_id, name, country, city)
      VALUES (${exhibitorAccountId}, ${`Cinema ${TEST_ID}`}, 'FR', 'Paris')
      RETURNING id
    `;
    if (!cinema) throw new Error("Failed to create cinema");
    cinemaId = cinema.id;

    const [room] = await dbSql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinemaId}, 'Salle 1', 200)
      RETURNING id
    `;
    if (!room) throw new Error("Failed to create room");
    roomId = room.id;

    // ── Film (direct, active, priced in FR) ──
    const [film] = await dbSql`
      INSERT INTO films (
        account_id, title, type, status, release_year, directors, countries
      ) VALUES (
        ${rhCtx.accountId},
        ${`Tracking Test Film ${TEST_ID}`},
        'direct', 'active', 1960, ARRAY['Jean Renoir'], ARRAY['FR']
      ) RETURNING id
    `;
    if (!film) throw new Error("Failed to create film");
    filmId = film.id;

    await dbSql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${filmId}, ARRAY['FR'], 50000, 'EUR')
    `;
  });

  test.afterAll(async () => {
    // Clean up in FK-safe order
    if (filmId) await dbSql`DELETE FROM film_events WHERE film_id = ${filmId}`;
    if (filmId) await dbSql`DELETE FROM cart_items WHERE film_id = ${filmId}`;
    if (filmId) await dbSql`DELETE FROM film_prices WHERE film_id = ${filmId}`;
    if (filmId) await dbSql`DELETE FROM films WHERE id = ${filmId}`;
    if (roomId) await dbSql`DELETE FROM rooms WHERE id = ${roomId}`;
    if (cinemaId) await dbSql`DELETE FROM cinemas WHERE id = ${cinemaId}`;

    // Clean up accounts (cascades to account_members, api_tokens)
    if (exhibitorAccountId) await dbSql`DELETE FROM accounts WHERE id = ${exhibitorAccountId}`;
    // rhCtx and adminCtx accounts + users
    if (rhCtx?.accountId) await dbSql`DELETE FROM accounts WHERE id = ${rhCtx.accountId}`;
    if (adminCtx?.accountId) await dbSql`DELETE FROM accounts WHERE id = ${adminCtx.accountId}`;

    await dbSql.end();
  });

  // ─── 1. View event tracking ─────────────────────────────────────────────────

  test("visiting film detail page records a view event in the database", async ({ page }) => {
    // Count existing view events before navigation
    const [before] = await dbSql`
      SELECT COUNT(*)::int AS total FROM film_events
      WHERE film_id = ${filmId} AND event_type = 'view'
    `;
    const viewsBefore = before?.total ?? 0;

    // Sign in as exhibitor
    const signInRes = await page.request.post("/api/auth/sign-in/email", {
      data: { email: exhibitorEmail, password: exhibitorPassword },
      headers: { "Content-Type": "application/json" },
    });
    expect(signInRes.ok()).toBeTruthy();

    await page.context().addCookies([
      {
        name: "active_account_id",
        value: `${exhibitorAccountId}:exhibitor`,
        url: BASE_URL,
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // Navigate to film detail page
    await page.goto(`/en/catalog/${filmId}`);
    await expect(page.getByText(`Tracking Test Film ${TEST_ID}`)).toBeVisible({ timeout: 15000 });

    // Wait briefly for the fire-and-forget tracking to complete
    await page.waitForTimeout(1000);

    // Verify a new view event was inserted
    const [after] = await dbSql`
      SELECT COUNT(*)::int AS total FROM film_events
      WHERE film_id = ${filmId} AND event_type = 'view'
    `;
    const viewsAfter = after?.total ?? 0;

    expect(viewsAfter).toBe(viewsBefore + 1);
  });

  // ─── 2. Cart add event tracking ────────────────────────────────────────────

  test("adding film to cart records a cart_add event in the database", async ({ page }) => {
    // Count existing cart_add events before
    const [before] = await dbSql`
      SELECT COUNT(*)::int AS total FROM film_events
      WHERE film_id = ${filmId} AND event_type = 'cart_add'
    `;
    const cartAddsBefore = before?.total ?? 0;

    // Sign in as exhibitor
    const signInRes = await page.request.post("/api/auth/sign-in/email", {
      data: { email: exhibitorEmail, password: exhibitorPassword },
      headers: { "Content-Type": "application/json" },
    });
    expect(signInRes.ok()).toBeTruthy();

    await page.context().addCookies([
      {
        name: "active_account_id",
        value: `${exhibitorAccountId}:exhibitor`,
        url: BASE_URL,
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // Navigate to film detail page
    await page.goto(`/en/catalog/${filmId}`);
    await expect(page.getByText(`Tracking Test Film ${TEST_ID}`)).toBeVisible({ timeout: 15000 });

    // Open booking modal and add to cart
    await page.getByRole("button", { name: /add to cart/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 10000 });

    // Select cinema
    const cinemaCombobox = page.getByRole("dialog").getByRole("combobox").first();
    await cinemaCombobox.click();
    await page.getByRole("option", { name: new RegExp(`Cinema ${TEST_ID}`, "i") }).click();

    // Select room
    const roomCombobox = page.getByRole("dialog").getByRole("combobox").nth(1);
    await roomCombobox.click();
    await page.getByRole("option", { name: /Salle 1/i }).click();

    // Submit
    await page.getByRole("dialog").getByRole("button", { name: /add to cart/i }).click();

    // Wait for success feedback (toast or modal close)
    await expect(page.getByText(/added to cart|ajouté au panier/i)).toBeVisible({ timeout: 10000 });

    // Verify a new cart_add event was inserted
    const [after] = await dbSql`
      SELECT COUNT(*)::int AS total FROM film_events
      WHERE film_id = ${filmId} AND event_type = 'cart_add'
    `;
    const cartAddsAfter = after?.total ?? 0;

    expect(cartAddsAfter).toBe(cartAddsBefore + 1);
  });

  // ─── 3. RH film detail shows analytics ─────────────────────────────────────

  test("rights holder film detail page displays analytics stats", async ({ page }) => {
    // Seed some events so analytics are visible
    await dbSql`
      INSERT INTO film_events (film_id, account_id, event_type)
      VALUES
        (${filmId}, ${exhibitorAccountId}, 'view'),
        (${filmId}, ${exhibitorAccountId}, 'view'),
        (${filmId}, ${exhibitorAccountId}, 'view'),
        (${filmId}, ${exhibitorAccountId}, 'cart_add'),
        (${filmId}, ${exhibitorAccountId}, 'cart_add')
    `;

    // Login as rights holder
    await loginAsRightsHolder(page, rhCtx);

    // Navigate to film detail (RH edit page)
    await page.goto(`/en/films/${filmId}`);

    // Verify analytics section is visible with KPI labels (scoped to main to avoid sidebar text collisions)
    const mainContent = page.getByRole("main");
    await expect(mainContent.getByText("Film analytics")).toBeVisible({ timeout: 15000 });
    await expect(mainContent.getByText("Views")).toBeVisible();
    await expect(mainContent.getByText("Cart additions")).toBeVisible();
    await expect(mainContent.getByText("Requests", { exact: true })).toBeVisible();
    await expect(mainContent.getByText("Revenue")).toBeVisible();

    // Verify the activity chart section
    await expect(mainContent.getByText("Activity (last 30 days)")).toBeVisible();
  });

  // ─── 4. Admin film detail shows analytics ──────────────────────────────────

  test("admin film detail page displays analytics stats", async ({ page }) => {
    // Login as admin
    await loginAsAdmin(page, adminCtx);

    // Navigate to admin film detail
    await page.goto(`/en/admin/films/${filmId}`);

    // Verify the film title is shown
    await expect(page.getByText(`Tracking Test Film ${TEST_ID}`)).toBeVisible({ timeout: 15000 });

    // Verify analytics KPIs are displayed (scoped to main to avoid sidebar text collisions)
    const mainContent = page.getByRole("main");
    await expect(mainContent.getByText("Views")).toBeVisible();
    await expect(mainContent.getByText("Cart additions")).toBeVisible();
    await expect(mainContent.getByText("Requests", { exact: true })).toBeVisible();
    await expect(mainContent.getByText("Revenue")).toBeVisible();

    // Verify the activity chart section
    await expect(mainContent.getByText("Activity (last 30 days)")).toBeVisible();
  });
});
