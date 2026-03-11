/**
 * E2E UI tests for E07 — Validation workflow.
 * Tests: RH dashboard (approve/reject from detail page), public token pages,
 * exhibitor request status updates.
 */
import { expect, test } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";

import {
  createRightsHolderContext,
  loginAsRightsHolder,
} from "./helpers/rights-holder";

import type { RightsHolderContext } from "./helpers/rights-holder";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://timeless:timeless@localhost:5432/timeless_test";
const BASE_URL = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? 3099}`;
const TEST_ID = Date.now().toString(36);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createExhibitorWithRequest(
  sql: ReturnType<typeof postgres>,
  rhAccountId: string,
  filmId: string,
  opts?: { note?: string }
): Promise<{
  exhibitorAccountId: string;
  requestId: string;
  cinemaName: string;
  roomName: string;
}> {
  const suffix = randomBytes(4).toString("hex");

  // Exhibitor account
  const companyName = `E07 UI Ex ${suffix}`;
  const [exhibitor] = await sql`
    INSERT INTO accounts (type, company_name, country, onboarding_completed)
    VALUES ('exhibitor', ${companyName}, 'FR', true)
    RETURNING id
  `;
  const exhibitorAccountId = exhibitor!.id;

  // Cinema + room
  const cinemaName = `Cinema ${suffix}`;
  const roomName = `Room ${suffix}`;
  const [cinema] = await sql`
    INSERT INTO cinemas (account_id, name, address, city, postal_code, country)
    VALUES (${exhibitorAccountId}, ${cinemaName}, '1 Rue Test', 'Paris', '75001', 'FR')
    RETURNING id
  `;
  const [room] = await sql`
    INSERT INTO rooms (cinema_id, name, capacity)
    VALUES (${cinema!.id}, ${roomName}, 100)
    RETURNING id
  `;

  // Create request
  const [request] = await sql`
    INSERT INTO requests (
      exhibitor_account_id, rights_holder_account_id, film_id,
      cinema_id, room_id, screening_count, note,
      catalog_price, currency, platform_margin_rate, delivery_fees,
      commission_rate, displayed_price, rights_holder_amount, timeless_amount,
      status
    ) VALUES (
      ${exhibitorAccountId}, ${rhAccountId}, ${filmId},
      ${cinema!.id}, ${room!.id}, 3, ${opts?.note ?? null},
      20000, 'EUR', '0.20', 1000, '0.10', 25000, 18000, 7000,
      'pending'
    )
    RETURNING id
  `;

  return {
    exhibitorAccountId,
    requestId: request!.id,
    cinemaName,
    roomName,
  };
}

/**
 * Generate a JWT validation token for a request (same logic as request-token-service).
 * We use jose directly because importing server code from Playwright is not possible.
 */
async function generateTestValidationToken(
  requestId: string,
  userId: string,
  secret: string
): Promise<string> {
  // Dynamic import of jose for JWT generation
  const { SignJWT } = await import("jose");
  const secretBytes = new TextEncoder().encode(secret);

  const token = await new SignJWT({ requestId, userId, action: "validate" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("14d")
    .setIssuedAt()
    .sign(secretBytes);

  return token;
}

// ─── RH Dashboard Tests ──────────────────────────────────────────────────────

test.describe("RH validation dashboard", () => {
  let sql: ReturnType<typeof postgres>;
  let rhContext: RightsHolderContext;
  let filmId: string;
  const filmTitle = `E07 UI Film ${TEST_ID}`;

  test.beforeAll(async ({ request }) => {
    sql = postgres(DATABASE_URL, { max: 1 });

    // Create RH context with helper
    rhContext = await createRightsHolderContext(request, TEST_ID, "rh-val-ui");

    // Create a film for this RH
    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rhContext.accountId}, ${filmTitle}, 'validation', 'active', 1960)
      RETURNING id
    `;
    filmId = film!.id;

    // Film price
    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${filmId}, ARRAY['FR'], 20000, 'EUR')
    `;
  });

  test.afterAll(async () => {
    await sql.end();
  });

  test("shows pending requests on validation-requests page", async ({ page }) => {
    // Create a pending request
    await createExhibitorWithRequest(sql, rhContext.accountId, filmId);

    await loginAsRightsHolder(page, rhContext);
    await page.goto("/en/validation-requests");
    await expect(page).toHaveURL(/\/en\/validation-requests/);

    // Should see the film title in the table
    await expect(page.getByText(filmTitle).first()).toBeVisible({ timeout: 15000 });
  });

  test("history tab shows approved/rejected requests", async ({ page }) => {
    // Create and approve a request
    const { requestId } = await createExhibitorWithRequest(sql, rhContext.accountId, filmId);
    await sql`UPDATE requests SET status = 'approved', approved_at = NOW() WHERE id = ${requestId}`;

    await loginAsRightsHolder(page, rhContext);
    await page.goto("/en/validation-requests");

    // Click History tab
    await page.getByRole("tab", { name: /history/i }).click();
    // Should see approved request
    await expect(page.getByText(filmTitle).first()).toBeVisible({ timeout: 15000 });
  });

  test("click navigates to request detail page", async ({ page }) => {
    await createExhibitorWithRequest(sql, rhContext.accountId, filmId);

    await loginAsRightsHolder(page, rhContext);
    await page.goto("/en/validation-requests");
    await expect(page.getByText(filmTitle).first()).toBeVisible({ timeout: 15000 });

    // Click on the film title link
    await page.getByText(filmTitle).first().click();

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/en\/validation-requests\/[a-f0-9-]+/, { timeout: 15000 });
  });

  test("detail page shows film, exhibitor, cinema, pricing info", async ({ page }) => {
    const { cinemaName, roomName } = await createExhibitorWithRequest(
      sql,
      rhContext.accountId,
      filmId,
      { note: "Please reserve for December" }
    );

    await loginAsRightsHolder(page, rhContext);
    await page.goto("/en/validation-requests");
    await expect(page.getByText(filmTitle).first()).toBeVisible({ timeout: 15000 });
    await page.getByText(filmTitle).first().click();
    await expect(page).toHaveURL(/\/en\/validation-requests\/[a-f0-9-]+/, { timeout: 15000 });

    // Check detail content
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(cinemaName)).toBeVisible();
    await expect(page.getByText(roomName)).toBeVisible();
    await expect(page.getByText("Please reserve for December")).toBeVisible();
    // Pricing section should show price
    await expect(page.getByText(/€/).first()).toBeVisible();
  });

  test("approve request with comment from detail page", async ({ page }) => {
    const { requestId } = await createExhibitorWithRequest(
      sql,
      rhContext.accountId,
      filmId
    );

    await loginAsRightsHolder(page, rhContext);
    await page.goto(`/en/validation-requests/${requestId}`);
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 15000 });

    // Fill comment
    await page.locator("#approvalNote").fill("Approved for December festival");

    // Click Accept
    await page.getByRole("button", { name: /accept/i }).click();

    // Confirmation dialog
    await expect(page.getByText(/are you sure/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /yes, accept/i }).click();

    // Should show success toast
    await expect(page.getByText(/approved successfully/i)).toBeVisible({ timeout: 15000 });

    // Verify in DB
    const [row] = await sql`SELECT status, approval_note FROM requests WHERE id = ${requestId}`;
    expect(row!.status).toBe("approved");
    expect(row!.approval_note).toBe("Approved for December festival");
  });

  test("reject request with reason from detail page", async ({ page }) => {
    const { requestId } = await createExhibitorWithRequest(
      sql,
      rhContext.accountId,
      filmId
    );

    await loginAsRightsHolder(page, rhContext);
    await page.goto(`/en/validation-requests/${requestId}`);
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 15000 });

    // Fill reason
    await page.locator("#rejectionReason").fill("Territory not available");

    // Click Refuse
    await page.getByRole("button", { name: /refuse/i }).click();

    // Confirmation dialog
    await expect(page.getByText(/are you sure/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /yes, decline/i }).click();

    // Should show success toast
    await expect(page.getByText(/declined successfully/i)).toBeVisible({ timeout: 15000 });

    // Verify in DB
    const [row] = await sql`SELECT status, rejection_reason FROM requests WHERE id = ${requestId}`;
    expect(row!.status).toBe("rejected");
    expect(row!.rejection_reason).toBe("Territory not available");
  });

  test("reject without reason still works", async ({ page }) => {
    const { requestId } = await createExhibitorWithRequest(
      sql,
      rhContext.accountId,
      filmId
    );

    await loginAsRightsHolder(page, rhContext);
    await page.goto(`/en/validation-requests/${requestId}`);
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: /refuse/i }).click();
    await expect(page.getByText(/are you sure/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /yes, decline/i }).click();

    // Should show success toast
    await expect(page.getByText(/declined successfully/i)).toBeVisible({ timeout: 15000 });

    const [row] = await sql`SELECT status, rejection_reason FROM requests WHERE id = ${requestId}`;
    expect(row!.status).toBe("rejected");
    expect(row!.rejection_reason).toBeNull();
  });

  test("approve/reject buttons only visible on pending requests", async ({ page }) => {
    const { requestId } = await createExhibitorWithRequest(
      sql,
      rhContext.accountId,
      filmId
    );
    // Mark as approved
    await sql`UPDATE requests SET status = 'approved', approved_at = NOW() WHERE id = ${requestId}`;

    await loginAsRightsHolder(page, rhContext);
    await page.goto(`/en/validation-requests/${requestId}`);
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 15000 });

    // Approve/Refuse buttons should NOT be visible
    await expect(page.getByRole("button", { name: /accept/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /refuse/i })).not.toBeVisible();

    // Approved status card should be visible
    await expect(page.getByText(/approved/i).first()).toBeVisible();
  });
});

// ─── Public Token Pages Tests ─────────────────────────────────────────────────

test.describe("Public token-based request action pages", () => {
  let sql: ReturnType<typeof postgres>;
  let rhAccountId: string;
  let rhUserId: string;
  let filmId: string;
  const filmTitle = `E07 Token Film ${TEST_ID}`;
  const authSecret = process.env.BETTER_AUTH_SECRET ?? "test-e2e-auth-secret-do-not-use-in-production";

  test.beforeAll(async () => {
    sql = postgres(DATABASE_URL, { max: 1 });

    // Create RH account
    const [rh] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('rights_holder', 'E07 Token RH', 'FR', true)
      RETURNING id
    `;
    rhAccountId = rh!.id;

    // RH user
    const rhSuffix = randomBytes(6).toString("hex");
    const [user] = await sql`
      INSERT INTO better_auth_users (id, email, email_verified, name, created_at, updated_at)
      VALUES (gen_random_uuid(), ${"rh-token-" + rhSuffix + "@test.local"}, true, 'Token RH', NOW(), NOW())
      RETURNING id
    `;
    rhUserId = user!.id;
    await sql`INSERT INTO account_members (account_id, user_id, role) VALUES (${rhAccountId}, ${rhUserId}, 'owner')`;

    // Film
    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rhAccountId}, ${filmTitle}, 'validation', 'active', 1975)
      RETURNING id
    `;
    filmId = film!.id;

    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${filmId}, ARRAY['FR'], 18000, 'EUR')
    `;
  });

  test.afterAll(async () => {
    await sql.end();
  });

  test("approve page shows request summary and comment field", async ({ page }) => {
    const { requestId } = await createExhibitorWithRequest(sql, rhAccountId, filmId);
    const token = await generateTestValidationToken(requestId, rhUserId, authSecret);

    await page.goto(`/en/request-action?token=${encodeURIComponent(token)}&action=approve`);

    // Should show film info
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 15000 });
    // Should show approval form elements
    await expect(page.getByText(/approve booking request/i)).toBeVisible();
    await expect(page.locator("#actionNote")).toBeVisible();
    await expect(page.getByRole("button", { name: /confirm approval/i })).toBeVisible();
  });

  test("approve via token shows confirmation dialog then success", async ({ page }) => {
    const { requestId } = await createExhibitorWithRequest(sql, rhAccountId, filmId, {
      note: "Weekend screening",
    });
    const token = await generateTestValidationToken(requestId, rhUserId, authSecret);

    await page.goto(`/en/request-action?token=${encodeURIComponent(token)}&action=approve`);
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 15000 });

    // Fill optional comment
    await page.locator("#actionNote").fill("Approved via email link");

    // Click confirm button
    await page.getByRole("button", { name: /confirm approval/i }).click();

    // Confirmation dialog
    await expect(page.getByText(/are you sure/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /confirm approval/i }).last().click();

    // Success message (in the page body, not the toast)
    await expect(page.locator("p").filter({ hasText: /request approved/i })).toBeVisible({ timeout: 15000 });

    // Verify DB
    const [row] = await sql`SELECT status, approval_note FROM requests WHERE id = ${requestId}`;
    expect(row!.status).toBe("approved");
    expect(row!.approval_note).toBe("Approved via email link");
  });

  test("reject page shows reason field", async ({ page }) => {
    const { requestId } = await createExhibitorWithRequest(sql, rhAccountId, filmId);
    const token = await generateTestValidationToken(requestId, rhUserId, authSecret);

    await page.goto(`/en/request-action?token=${encodeURIComponent(token)}&action=reject`);

    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/decline booking request/i)).toBeVisible();
    await expect(page.locator("#actionNote")).toBeVisible();
    await expect(page.getByRole("button", { name: /confirm refusal/i })).toBeVisible();
  });

  test("reject via token transitions to rejected", async ({ page }) => {
    const { requestId } = await createExhibitorWithRequest(sql, rhAccountId, filmId);
    const token = await generateTestValidationToken(requestId, rhUserId, authSecret);

    await page.goto(`/en/request-action?token=${encodeURIComponent(token)}&action=reject`);
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 15000 });

    await page.locator("#actionNote").fill("Not in our catalog anymore");
    await page.getByRole("button", { name: /confirm refusal/i }).click();
    await expect(page.getByText(/are you sure/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /confirm refusal/i }).last().click();

    // Success message (in the page body, not the toast)
    await expect(page.locator("p").filter({ hasText: /request declined/i })).toBeVisible({ timeout: 15000 });

    const [row] = await sql`SELECT status, rejection_reason FROM requests WHERE id = ${requestId}`;
    expect(row!.status).toBe("rejected");
    expect(row!.rejection_reason).toBe("Not in our catalog anymore");
  });

  test("invalid token shows error message", async ({ page }) => {
    await page.goto("/en/request-action?token=invalid-token-xyz&action=approve");

    await expect(page.getByText(/not valid/i)).toBeVisible({ timeout: 15000 });
  });

  test("already-approved request shows message", async ({ page }) => {
    const { requestId } = await createExhibitorWithRequest(sql, rhAccountId, filmId);
    // Approve it first
    await sql`UPDATE requests SET status = 'approved', approved_at = NOW() WHERE id = ${requestId}`;

    const token = await generateTestValidationToken(requestId, rhUserId, authSecret);
    await page.goto(`/en/request-action?token=${encodeURIComponent(token)}&action=approve`);

    await expect(page.getByText(/already been approved/i)).toBeVisible({ timeout: 15000 });
  });

  test("already-rejected request shows message", async ({ page }) => {
    const { requestId } = await createExhibitorWithRequest(sql, rhAccountId, filmId);
    await sql`UPDATE requests SET status = 'rejected', rejected_at = NOW() WHERE id = ${requestId}`;

    const token = await generateTestValidationToken(requestId, rhUserId, authSecret);
    await page.goto(`/en/request-action?token=${encodeURIComponent(token)}&action=reject`);

    await expect(page.getByText(/already been declined/i)).toBeVisible({ timeout: 15000 });
  });
});

// ─── Exhibitor side — E07 status updates ──────────────────────────────────────

test.describe("Exhibitor request status updates", () => {
  let sql: ReturnType<typeof postgres>;
  let exhibitorEmail: string;
  let exhibitorPassword: string;
  let exhibitorAccountId: string;
  let rhAccountId: string;
  let filmId: string;
  let cinemaId: string;
  let roomId: string;
  const filmTitle = `E07 ExUI Film ${TEST_ID}`;

  async function loginAsExhibitor(page: import("@playwright/test").Page) {
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

    // Navigate to home first to establish page context, then to requests
    await page.goto("/en/home");
    await expect(page).toHaveURL(/\/en\//, { timeout: 15000 });
    await page.goto("/en/requests");
    await expect(page).toHaveURL(/\/en\/requests/, { timeout: 15000 });
  }

  test.beforeAll(async ({ request }) => {
    sql = postgres(DATABASE_URL, { max: 1 });

    // RH with film
    const [rh] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('rights_holder', 'E07 ExUI RH', 'FR', true)
      RETURNING id
    `;
    rhAccountId = rh!.id;

    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rhAccountId}, ${filmTitle}, 'validation', 'active', 1980)
      RETURNING id
    `;
    filmId = film!.id;

    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${filmId}, ARRAY['FR'], 22000, 'EUR')
    `;

    // Exhibitor account
    const [exhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('exhibitor', 'E07 ExUI Company', 'FR', true)
      RETURNING id
    `;
    exhibitorAccountId = exhibitor!.id;

    // Cinema + room
    const [cinema] = await sql`
      INSERT INTO cinemas (account_id, name, address, city, postal_code, country)
      VALUES (${exhibitorAccountId}, 'ExUI Cinema', '5 Rue ExUI', 'Paris', '75001', 'FR')
      RETURNING id
    `;
    cinemaId = cinema!.id;
    const [room] = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinemaId}, 'Salle ExUI', 80)
      RETURNING id
    `;
    roomId = room!.id;

    // Register exhibitor user via API
    const exSuffix = randomBytes(6).toString("hex");
    exhibitorEmail = `exui-e07-${exSuffix}@test.local`;
    exhibitorPassword = "StrongPass123!";

    const signupRes = await request.post("/api/auth/sign-up/email", {
      data: { name: "ExUI Tester", email: exhibitorEmail, password: exhibitorPassword },
      headers: { "Content-Type": "application/json" },
    });
    expect(signupRes.ok()).toBeTruthy();
    await sql`UPDATE better_auth_users SET email_verified = true WHERE email = ${exhibitorEmail}`;

    const [user] = await sql`SELECT id FROM better_auth_users WHERE email = ${exhibitorEmail}`;
    await sql`
      INSERT INTO account_members (account_id, user_id, role)
      VALUES (${exhibitorAccountId}, ${user!.id}, 'owner')
    `;

    // Create a rejected request with reason
    await sql`
      INSERT INTO requests (
        exhibitor_account_id, rights_holder_account_id, film_id,
        cinema_id, room_id, screening_count,
        catalog_price, currency, platform_margin_rate, delivery_fees,
        commission_rate, displayed_price, rights_holder_amount, timeless_amount,
        status, rejection_reason, rejected_at
      ) VALUES (
        ${exhibitorAccountId}, ${rhAccountId}, ${filmId},
        ${cinemaId}, ${roomId}, 2,
        22000, 'EUR', '0.20', 1000, '0.10', 27500, 19800, 7700,
        'rejected', 'Not available for this period', NOW()
      )
    `;

    // Create an approved request with note
    await sql`
      INSERT INTO requests (
        exhibitor_account_id, rights_holder_account_id, film_id,
        cinema_id, room_id, screening_count,
        catalog_price, currency, platform_margin_rate, delivery_fees,
        commission_rate, displayed_price, rights_holder_amount, timeless_amount,
        status, approval_note, approved_at
      ) VALUES (
        ${exhibitorAccountId}, ${rhAccountId}, ${filmId},
        ${cinemaId}, ${roomId}, 1,
        22000, 'EUR', '0.20', 1000, '0.10', 27500, 19800, 7700,
        'approved', 'Happy to help with your festival', NOW()
      )
    `;
  });

  test.afterAll(async () => {
    await sql.end();
  });

  test("shows rejection reason and approval note on request cards", async ({ page }) => {
    await loginAsExhibitor(page);

    // Pending tab (default) shows approved requests — check approval note
    await expect(page.getByText(/happy to help with your festival/i)).toBeVisible({ timeout: 15000 });

    // Switch to History tab to see rejected requests
    await page.getByRole("tab", { name: /history/i }).click();

    // Should see the rejection reason
    await expect(page.getByText(/not available for this period/i)).toBeVisible({ timeout: 15000 });
  });

  test("status badges are visually distinct", async ({ page }) => {
    await loginAsExhibitor(page);

    // Pending tab shows approved requests — green badge
    await expect(page.getByText(filmTitle).first()).toBeVisible({ timeout: 15000 });
    const approvedBadge = page.locator('[class*="bg-green-100"]');
    await expect(approvedBadge.first()).toBeVisible({ timeout: 5000 });

    // Switch to History tab — red badge for rejected
    await page.getByRole("tab", { name: /history/i }).click();
    await expect(page.getByText(filmTitle).first()).toBeVisible({ timeout: 15000 });
    const rejectedBadge = page.locator('[class*="bg-red-100"]');
    await expect(rejectedBadge.first()).toBeVisible({ timeout: 5000 });
  });

  test("cancel confirmation modal works", async ({ page }) => {
    // Create a pending request
    await sql`
      INSERT INTO requests (
        exhibitor_account_id, rights_holder_account_id, film_id,
        cinema_id, room_id, screening_count,
        catalog_price, currency, platform_margin_rate, delivery_fees,
        commission_rate, displayed_price, rights_holder_amount, timeless_amount,
        status
      ) VALUES (
        ${exhibitorAccountId}, ${rhAccountId}, ${filmId},
        ${cinemaId}, ${roomId}, 1,
        22000, 'EUR', '0.20', 1000, '0.10', 27500, 19800, 7700,
        'pending'
      )
    `;

    await loginAsExhibitor(page);

    await expect(page.getByText(filmTitle).first()).toBeVisible({ timeout: 15000 });

    // Click cancel (trash) button on the pending request card
    const trashButton = page.locator("button").filter({ has: page.locator("svg.lucide-trash-2") }).first();
    await trashButton.click();

    // Cancel confirmation dialog should appear
    await expect(page.getByText(/are you sure you want to cancel/i)).toBeVisible({ timeout: 5000 });

    // Click confirm
    await page.getByRole("button", { name: /yes, cancel/i }).click();

    // Toast should confirm success
    await expect(page.getByText(/cancelled successfully/i)).toBeVisible({ timeout: 10000 });
  });
});
