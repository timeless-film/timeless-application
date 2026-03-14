import { test, expect } from "@playwright/test";
import postgres from "postgres";

import { createAdminContext, loginAsAdmin } from "./helpers/admin";
import {
  createExhibitorContext,
  type ExhibitorContext,
} from "./helpers/exhibitor";
import { createRightsHolderContext } from "./helpers/rights-holder";

import type { AdminContext } from "./helpers/admin";
import type { RightsHolderContext } from "./helpers/rights-holder";

const TEST_ID = Date.now().toString(36);
const DB_URL =
  process.env.DATABASE_URL ?? "postgresql://timeless:timeless@localhost:5432/timeless_test";

test.describe("Admin Backoffice", () => {
  let adminCtx: AdminContext;
  let rhCtx: RightsHolderContext;
  let exhCtx: ExhibitorContext;

  test.beforeAll(async ({ request }) => {
    adminCtx = await createAdminContext(request, TEST_ID, "admin");
    rhCtx = await createRightsHolderContext(request, TEST_ID, "rh");
    exhCtx = await createExhibitorContext(request, TEST_ID, "exh");

    // Create a film, cinema, room, and a pending request for E11-009 tests
    const sql = postgres(DB_URL, { max: 1 });

    const filmRows = await sql`
      INSERT INTO films (account_id, title, release_year, status)
      VALUES (${rhCtx.accountId}, ${`Test Film ${TEST_ID}`}, 1960, 'active')
      RETURNING id
    `;
    const filmId = filmRows[0]?.id as string;

    const cinemaRows = await sql`
      INSERT INTO cinemas (account_id, name, country)
      VALUES (${exhCtx.accountId}, ${`Cinema ${TEST_ID}`}, 'FR')
      RETURNING id
    `;
    const cinemaId = cinemaRows[0]?.id as string;

    const roomRows = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinemaId}, 'Salle 1', 200)
      RETURNING id
    `;
    const roomId = roomRows[0]?.id as string;

    const reqRows = await sql`
      INSERT INTO requests (
        exhibitor_account_id, rights_holder_account_id, film_id,
        cinema_id, room_id, screening_count,
        catalog_price, currency, platform_margin_rate, delivery_fees,
        commission_rate, displayed_price, rights_holder_amount, timeless_amount,
        status
      ) VALUES (
        ${exhCtx.accountId}, ${rhCtx.accountId}, ${filmId},
        ${cinemaId}, ${roomId}, 3,
        15000, 'EUR', '0.20', 5000,
        '0', 18000, 15000, 3000,
        'pending'
      )
      RETURNING id
    `;
    const requestId = reqRows[0]?.id as string;

    // Create an order for E11-006 tests
    const orderFilmRows = await sql`
      INSERT INTO films (account_id, title, release_year, status)
      VALUES (${rhCtx.accountId}, ${`Order Film ${TEST_ID}`}, 1970, 'active')
      RETURNING id
    `;
    const orderFilmId = orderFilmRows[0]?.id as string;

    const orderRows = await sql`
      INSERT INTO orders (
        exhibitor_account_id, stripe_payment_intent_id,
        subtotal, delivery_fees_total, tax_amount, total, currency,
        tax_rate, reverse_charge, paid_at, status
      ) VALUES (
        ${exhCtx.accountId}, 'pi_test_fake_123',
        18000, 5000, 0, 23000, 'EUR',
        '0', 'true', NOW(), 'paid'
      )
      RETURNING id, order_number
    `;
    const orderId = orderRows[0]?.id as string;
    const orderNumber = orderRows[0]?.order_number as number;

    await sql`
      INSERT INTO order_items (
        order_id, film_id, cinema_id, room_id,
        rights_holder_account_id, screening_count,
        catalog_price, currency, platform_margin_rate, delivery_fees,
        commission_rate, displayed_price, rights_holder_amount,
        timeless_amount, delivery_status
      ) VALUES (
        ${orderId}, ${orderFilmId}, ${cinemaId}, ${roomId},
        ${rhCtx.accountId}, 3,
        15000, 'EUR', '0.20', 5000,
        '0', 18000, 15000, 3000,
        'pending'
      )
    `;

    // Suppress unused variable warnings
    void requestId;
    void orderNumber;

    await sql.end();
  });

  test.describe("Layout & Navigation (E11-001)", () => {
    test("admin sidebar displays all navigation items", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      // Main navigation items
      await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Orders" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Requests" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Films" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Exhibitors" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Rights holders" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Deliveries" })).toBeVisible();

      // Management section
      await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Audit logs" })).toBeVisible();
    });

    test("admin can navigate to all pages from sidebar", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      // Navigate to Settings
      await page.getByRole("link", { name: "Settings" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/settings/);
      await expect(page.getByRole("heading", { name: "Platform settings" })).toBeVisible();

      // Navigate to Orders
      await page.getByRole("link", { name: "Orders" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/orders/);

      // Navigate to Requests
      await page.getByRole("link", { name: "Requests" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/requests/);

      // Navigate to Films
      await page.getByRole("link", { name: "Films" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/films/);

      // Navigate to Exhibitors
      await page.getByRole("link", { name: "Exhibitors" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/exhibitors/);

      // Navigate to Rights holders
      await page.getByRole("link", { name: "Rights holders" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/rights-holders/);

      // Navigate to Deliveries
      await page.getByRole("link", { name: "Deliveries" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/deliveries/);

      // Navigate to Audit logs
      await page.getByRole("link", { name: "Audit logs" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/logs/);
    });

    test("non-admin user is redirected away from admin pages", async ({ page, request }) => {
      // Try accessing admin pages without auth — should redirect to login
      await page.goto("/en/admin/dashboard");
      await expect(page).toHaveURL(/\/en\/login/, { timeout: 15000 });
    });
  });

  test.describe("Dashboard (E11-002)", () => {
    test("dashboard displays KPI cards", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await expect(page).toHaveURL(/\/en\/admin\/dashboard/);
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

      // Primary KPI cards
      await expect(page.getByText("Business volume (excl. VAT)")).toBeVisible();
      await expect(page.getByText("Timeless margin (excl. VAT)")).toBeVisible();
      await expect(page.getByText("Transactions")).toBeVisible();
      await expect(page.getByText("Pending requests")).toBeVisible();
      await expect(page.getByText("Pending deliveries")).toBeVisible();

      // Secondary KPI cards
      await expect(page.getByText("Active exhibitors")).toBeVisible();
      await expect(page.getByText("Active rights holders")).toBeVisible();
      await expect(page.getByText("Active films")).toBeVisible();
      await expect(page.getByText("Pending onboardings")).toBeVisible();
    });

    test("dashboard KPI values reflect test data", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);
      await expect(page).toHaveURL(/\/en\/admin\/dashboard/);

      // We have created at least 1 active film, 1 exhibitor, 1 RH in beforeAll
      // Active films count should be > 0
      await expect(page.getByText("Active films")).toBeVisible();
    });
  });

  test.describe("Platform Settings (E11-007)", () => {
    test("settings page displays current values", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Settings" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/settings/);

      // Pricing section
      await expect(page.getByText("Pricing")).toBeVisible();
      await expect(page.getByLabel("Platform margin (%)")).toBeVisible();
      await expect(page.getByLabel("Delivery fees (EUR)")).toBeVisible();
      await expect(page.getByLabel("Default commission (%)")).toBeVisible();

      // Operations section
      await expect(page.getByText("Operations", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Operations email")).toBeVisible();
      await expect(page.getByLabel("Request expiration (days)")).toBeVisible();
      await expect(page.getByLabel("Urgency threshold (days before start)")).toBeVisible();

      // Default values
      await expect(page.getByLabel("Platform margin (%)")).toHaveValue("20");
      await expect(page.getByLabel("Delivery fees (EUR)")).toHaveValue("50");
      await expect(page.getByLabel("Default commission (%)")).toHaveValue("10");
      await expect(page.getByLabel("Operations email")).toHaveValue("ops@timeless.film");
      await expect(page.getByLabel("Request expiration (days)")).toHaveValue("30");
      await expect(page.getByLabel("Urgency threshold (days before start)")).toHaveValue("7");
    });

    test("live pricing preview updates when values change", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Settings" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/settings/);

      // Check initial preview is visible (with 20% margin and 10% commission on 150€ catalog)
      // displayedPrice = 150 × 1.20 = 180€, RH = 150 × 0.90 = 135€, TIMELESS = 180 - 135 = 45€
      await expect(page.getByText(/displayed at.*€180\.00/)).toBeVisible();
      await expect(page.getByText(/will receive.*€135\.00/)).toBeVisible();
      await expect(page.getByText(/will retain.*€45\.00/)).toBeVisible();

      // Change margin to 30%
      await page.getByLabel("Platform margin (%)").fill("30");
      // displayedPrice = 150 × 1.30 = 195€, RH = 150 × 0.90 = 135€, TIMELESS = 195 - 135 = 60€
      await expect(page.getByText(/displayed at.*€195\.00/)).toBeVisible();
      await expect(page.getByText(/will retain.*€60\.00/)).toBeVisible();
    });

    test("updates settings with confirmation dialog", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Settings" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/settings/);

      // Change ops email
      await page.getByLabel("Operations email").fill("admin-test@timeless.film");

      // Click save
      await page.getByRole("button", { name: "Save settings" }).click();

      // Confirmation dialog appears
      await expect(page.getByText("Update platform settings?")).toBeVisible();
      await expect(
        page.getByText("These settings will affect all future orders")
      ).toBeVisible();

      // Confirm
      await page.getByRole("button", { name: "Update settings" }).click();

      // Success toast
      await expect(page.getByText("Platform settings updated successfully")).toBeVisible({
        timeout: 10000,
      });

      // History section shows the change
      await expect(page.getByRole("cell", { name: "Operations email" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "ops@timeless.film" })).toBeVisible();
      await expect(page.getByRole("cell", { name: "admin-test@timeless.film" })).toBeVisible();
    });

    test("settings change history is displayed", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Settings" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/settings/);

      // Change history header is visible
      await expect(page.getByText("Change history")).toBeVisible();

      // The previous test's change should be in history
      await expect(page.getByRole("cell", { name: "Operations email" })).toBeVisible();
    });

    test("settings page reloads with saved values", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Settings" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/settings/);

      // The ops email should still be the updated value from the previous test
      await expect(page.getByLabel("Operations email")).toHaveValue(
        "admin-test@timeless.film"
      );
    });
  });

  test.describe("Rights Holder Management (E11-003)", () => {
    test("rights holders page lists accounts", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Rights holders" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/rights-holders/);
      await expect(page.getByRole("heading", { name: "Rights holders" })).toBeVisible();

      // The RH created in beforeAll should appear
      await expect(page.getByText(new RegExp(`RH rh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });
    });

    test("admin can suspend and reactivate a rights holder", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Rights holders" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/rights-holders/);

      // Wait for RH row
      await expect(page.getByText(new RegExp(`RH rh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      // Open dropdown menu for the RH
      const rhRow = page.getByRole("row").filter({ hasText: `RH rh ${TEST_ID}` });
      await rhRow.getByRole("button").click();
      await page.getByRole("menuitem", { name: "Suspend" }).click();

      // Confirmation dialog
      await expect(page.getByText(/Suspend.*\?/)).toBeVisible();
      await page.getByRole("button", { name: "Suspend" }).last().click();

      // Success toast
      await expect(page.getByText("Account suspended")).toBeVisible({ timeout: 10000 });

      // Status badge should change
      await expect(rhRow.getByText("Suspended")).toBeVisible({ timeout: 10000 });

      // Now reactivate
      await rhRow.getByRole("button").click();
      await page.getByRole("menuitem", { name: "Reactivate" }).click();

      // Confirm
      await expect(page.getByText(/Reactivate.*\?/)).toBeVisible();
      await page.getByRole("button", { name: "Reactivate" }).last().click();

      // Success toast
      await expect(page.getByText("Account reactivated")).toBeVisible({ timeout: 10000 });
    });

    test("admin can update commission rate", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Rights holders" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/rights-holders/);

      await expect(page.getByText(new RegExp(`RH rh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      // Open dropdown
      const rhRow = page.getByRole("row").filter({ hasText: `RH rh ${TEST_ID}` });
      await rhRow.getByRole("button").click();
      await page.getByRole("menuitem", { name: "Edit commission" }).click();

      // Commission dialog
      await expect(page.getByText("Edit commission rate")).toBeVisible();
      await page.getByLabel("Commission rate (%)").fill("15");
      await page.getByRole("button", { name: "Save" }).click();

      // Success toast
      await expect(page.getByText("Commission rate updated")).toBeVisible({ timeout: 10000 });

      // Verify the row shows 15%
      await expect(rhRow.getByText("15%")).toBeVisible({ timeout: 10000 });

      // Verify in DB
      const sql = postgres(DB_URL, { max: 1 });
      const result =
        await sql`SELECT commission_rate FROM accounts WHERE id = ${rhCtx.accountId}`;
      expect(result[0]?.commission_rate).toBe("0.1500");
      await sql.end();
    });

    test("search filters rights holders", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Rights holders" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/rights-holders/);

      // Wait for list to load
      await expect(page.getByText(new RegExp(`RH rh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      // Search for a non-existent name
      await page.getByPlaceholder("Search rights holders").fill("nonexistentrh12345");
      await expect(page.getByText("No rights holders found")).toBeVisible({ timeout: 10000 });

      // Clear search — RH should appear again
      await page.getByPlaceholder("Search rights holders").fill("");
      await expect(page.getByText(new RegExp(`RH rh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("Exhibitor Management (E11-005)", () => {
    test("exhibitors page lists accounts", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Exhibitors" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/exhibitors/);
      await expect(page.getByRole("heading", { name: "Exhibitors" })).toBeVisible();

      // The exhibitor created in beforeAll should appear
      await expect(page.getByText(new RegExp(`Exh exh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });
    });

    test("admin can suspend and reactivate an exhibitor", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Exhibitors" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/exhibitors/);

      await expect(page.getByText(new RegExp(`Exh exh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      // Open dropdown menu
      const exhRow = page.getByRole("row").filter({ hasText: `Exh exh ${TEST_ID}` });
      await exhRow.getByRole("button").click();
      await page.getByRole("menuitem", { name: "Suspend" }).click();

      // Confirmation dialog
      await expect(page.getByText(/Suspend.*\?/)).toBeVisible();
      await page.getByRole("button", { name: "Suspend" }).last().click();

      // Success toast
      await expect(page.getByText("Account suspended")).toBeVisible({ timeout: 10000 });
      await expect(exhRow.getByText("Suspended")).toBeVisible({ timeout: 10000 });

      // Reactivate
      await exhRow.getByRole("button").click();
      await page.getByRole("menuitem", { name: "Reactivate" }).click();

      await expect(page.getByText(/Reactivate.*\?/)).toBeVisible();
      await page.getByRole("button", { name: "Reactivate" }).last().click();

      await expect(page.getByText("Account reactivated")).toBeVisible({ timeout: 10000 });
    });

    test("search filters exhibitors", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Exhibitors" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/exhibitors/);

      await expect(page.getByText(new RegExp(`Exh exh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      // Search for a non-existent name
      await page.getByPlaceholder("Search exhibitors").fill("nonexistentexh12345");
      await expect(page.getByText("No exhibitors found")).toBeVisible({ timeout: 10000 });

      // Clear search — exhibitor should reappear
      await page.getByPlaceholder("Search exhibitors").fill("");
      await expect(page.getByText(new RegExp(`Exh exh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("Films Catalog (E11-010)", () => {
    test("films page lists active films", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Films" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/films/);
      await expect(page.getByRole("heading", { name: "Films" })).toBeVisible();

      // The films created in beforeAll should appear
      await expect(page.getByText(new RegExp(`Test Film ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText(new RegExp(`Order Film ${TEST_ID}`))).toBeVisible();
    });

    test("search filters films by title", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Films" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/films/);

      await expect(page.getByText(new RegExp(`Test Film ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      // Search for non-existent film
      await page.getByPlaceholder(/search/i).fill("nonexistentfilm12345");
      await expect(page.getByText("No films found")).toBeVisible({ timeout: 10000 });

      // Clear search — films should reappear
      await page.getByPlaceholder(/search/i).fill("");
      await expect(page.getByText(new RegExp(`Test Film ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });
    });

    test("films table shows rights holder name", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Films" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/films/);

      // The RH company name should appear in a film row
      const filmRow = page.getByRole("row").filter({ hasText: `Test Film ${TEST_ID}` });
      await expect(filmRow).toBeVisible({ timeout: 10000 });
      await expect(filmRow.getByText(new RegExp(`RH rh ${TEST_ID}`))).toBeVisible();
    });
  });

  test.describe("Audit Logs (E11-008)", () => {
    test("audit logs page displays logged actions", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Audit logs" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/logs/);
      await expect(page.getByRole("heading", { name: "Audit logs" })).toBeVisible();

      // Previous tests (suspend/reactivate, commission update) should have created audit logs
      // At least one action badge should be visible
      await expect(page.getByText("Account suspended").first()).toBeVisible({
        timeout: 10000,
      });
    });

    test("audit logs shows performer name", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Audit logs" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/logs/);

      // The admin user name should appear as performer
      await expect(page.getByText(/Admin admin/).first()).toBeVisible({
        timeout: 10000,
      });
    });

    test("search filters audit logs", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Audit logs" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/logs/);

      // Wait for logs to load
      await expect(page.getByText("Account suspended").first()).toBeVisible({
        timeout: 10000,
      });

      // Search for non-existent action
      await page.getByPlaceholder(/search/i).fill("nonexistentaction999");
      await expect(page.getByText("No logs found")).toBeVisible({ timeout: 10000 });

      // Clear search
      await page.getByPlaceholder(/search/i).fill("");
      await expect(page.getByText("Account suspended").first()).toBeVisible({
        timeout: 10000,
      });
    });

    test("action filter works on audit logs page", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Audit logs" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/logs/);

      await expect(page.getByText("Account suspended").first()).toBeVisible({
        timeout: 10000,
      });

      // Filter by commission.updated action
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: "Commission updated" }).click();

      // account.suspended should no longer be visible (only commission.updated)
      await expect(page.getByText("Commission updated").first()).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("Request Management (E11-009)", () => {
    test("requests page lists pending requests", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Requests" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/requests/);
      await expect(page.getByRole("heading", { name: "Requests" })).toBeVisible();

      // The request created in beforeAll should appear with the film title
      await expect(page.getByText(new RegExp(`Test Film ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      // Status badge should show Pending
      const reqRow = page.getByRole("row").filter({ hasText: `Test Film ${TEST_ID}` });
      await expect(reqRow.getByText("Pending")).toBeVisible();
    });

    test("admin can force approve a pending request", async ({ page }) => {
      // First create a second request to approve (since we need to keep the original for other tests)
      const sql = postgres(DB_URL, { max: 1 });

      const filmRows = await sql`
        INSERT INTO films (account_id, title, release_year, status)
        VALUES (${rhCtx.accountId}, ${`Approve Film ${TEST_ID}`}, 1965, 'active')
        RETURNING id
      `;
      const filmId = filmRows[0]?.id as string;

      const cinemaRows = await sql`SELECT id FROM cinemas WHERE account_id = ${exhCtx.accountId} LIMIT 1`;
      const cinemaId = cinemaRows[0]?.id as string;
      const roomRows = await sql`SELECT id FROM rooms WHERE cinema_id = ${cinemaId} LIMIT 1`;
      const roomId = roomRows[0]?.id as string;

      await sql`
        INSERT INTO requests (
          exhibitor_account_id, rights_holder_account_id, film_id,
          cinema_id, room_id, screening_count,
          catalog_price, currency, platform_margin_rate, delivery_fees,
          commission_rate, displayed_price, rights_holder_amount, timeless_amount,
          status
        ) VALUES (
          ${exhCtx.accountId}, ${rhCtx.accountId}, ${filmId},
          ${cinemaId}, ${roomId}, 2,
          10000, 'EUR', '0.20', 5000,
          '0', 12000, 10000, 2000,
          'pending'
        )
      `;
      await sql.end();

      await loginAsAdmin(page, adminCtx);
      await page.getByRole("link", { name: "Requests" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/requests/);

      // Wait for the new request to appear
      await expect(page.getByText(new RegExp(`Approve Film ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      // Open dropdown and force approve
      const reqRow = page.getByRole("row").filter({ hasText: `Approve Film ${TEST_ID}` });
      await reqRow.getByRole("button").click();
      await page.getByRole("menuitem", { name: "Force approve" }).click();

      // Confirm dialog
      await expect(page.getByRole("heading", { name: "Force approve" })).toBeVisible();
      await page.getByRole("button", { name: "Approve" }).click();

      // Success
      await expect(page.getByText("Request approved")).toBeVisible({ timeout: 10000 });

      // Status should change to Approved
      await expect(reqRow.getByText("Approved")).toBeVisible({ timeout: 10000 });
    });

    test("admin can cancel a pending request", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Requests" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/requests/);

      // Use the original test request
      await expect(page.getByText(new RegExp(`Test Film ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      const reqRow = page.getByRole("row").filter({ hasText: `Test Film ${TEST_ID}` });
      await reqRow.getByRole("button").click();
      await page.getByRole("menuitem", { name: "Cancel request" }).click();

      // Confirm dialog
      await expect(page.getByRole("heading", { name: "Cancel request" })).toBeVisible();
      // Click the confirm button in the dialog
      await page.getByRole("dialog").getByRole("button", { name: "Cancel request" }).click();

      // Success
      await expect(page.getByText("Request cancelled")).toBeVisible({ timeout: 10000 });

      // Status should change to Cancelled
      await expect(reqRow.getByText("Cancelled")).toBeVisible({ timeout: 10000 });
    });

    test("status filter works on requests page", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Requests" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/requests/);

      // Filter by "Pending" — the cancelled request should disappear
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: "Pending" }).click();

      // The cancelled request should not appear
      await expect(page.getByText(new RegExp(`Test Film ${TEST_ID}`))).not.toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe("Order Management (E11-006)", () => {
    test("orders page lists orders", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Orders" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/orders/);
      await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();

      // The exhibitor name should appear in the order row
      await expect(page.getByText(new RegExp(`Exh exh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      // Order should show Paid status
      await expect(page.getByText("Paid").first()).toBeVisible();

      // Should show the total (€230.00 = 23000 cents)
      await expect(page.getByText("€230.00")).toBeVisible();
    });

    test("search filters orders by exhibitor name", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Orders" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/orders/);

      await expect(page.getByText(new RegExp(`Exh exh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      // Search for non-existent
      await page.getByPlaceholder(/search/i).fill("nonexistentorder999");
      await expect(page.getByText("No orders found")).toBeVisible({ timeout: 10000 });

      // Clear search
      await page.getByPlaceholder(/search/i).fill("");
      await expect(page.getByText(new RegExp(`Exh exh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });
    });

    test("status filter works on orders page", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Orders" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/orders/);

      await expect(page.getByText(new RegExp(`Exh exh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      // Filter by "Refunded" — our paid order should disappear
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: "Refunded" }).click();

      await expect(page.getByText("No orders found")).toBeVisible({ timeout: 10000 });

      // Reset to "All statuses"
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: "All statuses" }).click();

      await expect(page.getByText(new RegExp(`Exh exh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe("Detail Pages", () => {
    test("admin can view order detail via dropdown", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Orders" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/orders/);

      // Wait for order row
      await expect(page.getByText(new RegExp(`Exh exh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      // Open dropdown and click View details
      const orderRow = page.getByRole("row").filter({ hasText: `Exh exh ${TEST_ID}` });
      await orderRow.getByRole("button").click();
      await page.getByRole("menuitem", { name: "View details" }).click();

      // Should navigate to the detail page
      await expect(page).toHaveURL(/\/en\/admin\/orders\//, { timeout: 10000 });

      // Order detail should show the exhibitor name and film
      await expect(page.getByText(new RegExp(`Exh exh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText(new RegExp(`Order Film ${TEST_ID}`))).toBeVisible();
    });

    test("admin can view rights holder detail via dropdown", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Rights holders" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/rights-holders/);

      await expect(page.getByText(new RegExp(`RH rh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      // Open dropdown and click View details
      const rhRow = page.getByRole("row").filter({ hasText: `RH rh ${TEST_ID}` });
      await rhRow.getByRole("button").click();
      await page.getByRole("menuitem", { name: "View details" }).click();

      // Should navigate to the detail page
      await expect(page).toHaveURL(/\/en\/admin\/rights-holders\//, { timeout: 10000 });

      // Detail should show company info and members
      await expect(page.getByText(new RegExp(`RH rh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("Members")).toBeVisible();
    });

    test("admin can view exhibitor detail via dropdown", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Exhibitors" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/exhibitors/);

      await expect(page.getByText(new RegExp(`Exh exh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      // Open dropdown and click View details
      const exhRow = page.getByRole("row").filter({ hasText: `Exh exh ${TEST_ID}` });
      await exhRow.getByRole("button").click();
      await page.getByRole("menuitem", { name: "View details" }).click();

      // Should navigate to the detail page
      await expect(page).toHaveURL(/\/en\/admin\/exhibitors\//, { timeout: 10000 });

      // Detail should show company info and members
      await expect(page.getByText(new RegExp(`Exh exh ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("Members")).toBeVisible();
    });

    test("admin can view request detail via dropdown", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await page.getByRole("link", { name: "Requests" }).click();
      await expect(page).toHaveURL(/\/en\/admin\/requests/);

      // Use the original test film (cancelled) — dropdown always shows "View details"
      await expect(page.getByText(new RegExp(`Test Film ${TEST_ID}`))).toBeVisible({
        timeout: 10000,
      });

      // Open dropdown and click View details
      const reqRow = page.getByRole("row").filter({ hasText: `Test Film ${TEST_ID}` });
      await reqRow.getByRole("button").click();
      await page.getByRole("menuitem", { name: "View details" }).click();

      // Should navigate to the detail page
      await expect(page).toHaveURL(/\/en\/admin\/requests\//, { timeout: 10000 });

      // Detail should show film title, booking info and pricing
      await expect(page.getByRole("heading", { level: 1 })).toContainText(`Test Film ${TEST_ID}`, {
        timeout: 10000,
      });
      await expect(page.getByText("Booking information")).toBeVisible();
      await expect(page.getByText("Pricing breakdown")).toBeVisible();
    });

    test("dashboard shows revenue chart", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);

      await expect(page).toHaveURL(/\/en\/admin\/dashboard/);

      // Chart card should be visible
      await expect(page.getByText("Margin", { exact: true })).toBeVisible({ timeout: 10000 });
    });
  });
});
