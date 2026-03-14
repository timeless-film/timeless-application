import { test, expect } from "@playwright/test";
import postgres from "postgres";

import { createAdminContext, loginAsAdmin } from "./helpers/admin";
import { createExhibitorContext } from "./helpers/exhibitor";
import { createRightsHolderContext } from "./helpers/rights-holder";

import type { AdminContext } from "./helpers/admin";
import type { ExhibitorContext } from "./helpers/exhibitor";
import type { RightsHolderContext } from "./helpers/rights-holder";

const TEST_ID = Date.now().toString(36);
const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://timeless:timeless@localhost:5432/timeless_test";

test.describe("Delivery Management (E10)", () => {
  let adminCtx: AdminContext;
  let orderId: string;
  let orderItemId: string;
  let filmTitle: string;

  test.beforeAll(async ({ request }) => {
    adminCtx = await createAdminContext(request, TEST_ID, "delivery");

    const rhCtx: RightsHolderContext = await createRightsHolderContext(
      request,
      TEST_ID,
      "delivery-rh"
    );
    const exhCtx: ExhibitorContext = await createExhibitorContext(
      request,
      TEST_ID,
      "delivery-exh"
    );

    filmTitle = `Delivery Film ${TEST_ID}`;
    const sql = postgres(DB_URL, { max: 1 });

    const filmRows = await sql`
      INSERT INTO films (account_id, title, release_year, status)
      VALUES (${rhCtx.accountId}, ${filmTitle}, 1955, 'active')
      RETURNING id
    `;
    const filmId = filmRows[0]?.id as string;

    const cinemaRows = await sql`
      INSERT INTO cinemas (account_id, name, country)
      VALUES (${exhCtx.accountId}, ${`Delivery Cinema ${TEST_ID}`}, 'FR')
      RETURNING id
    `;
    const cinemaId = cinemaRows[0]?.id as string;

    const roomRows = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinemaId}, 'Salle Delivery', 150)
      RETURNING id
    `;
    const roomId = roomRows[0]?.id as string;

    // Create a paid order with a delivery item
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const startDate = nextWeek.toISOString().slice(0, 10);

    const endWeek = new Date();
    endWeek.setDate(endWeek.getDate() + 14);
    const endDate = endWeek.toISOString().slice(0, 10);

    const orderRows = await sql`
      INSERT INTO orders (
        exhibitor_account_id, stripe_payment_intent_id,
        subtotal, delivery_fees_total, tax_amount, total, currency,
        tax_rate, reverse_charge, paid_at, status
      ) VALUES (
        ${exhCtx.accountId}, ${`pi_delivery_test_${TEST_ID}`},
        15000, 5000, 0, 20000, 'EUR',
        '0', 'true', NOW(), 'paid'
      )
      RETURNING id
    `;
    orderId = orderRows[0]?.id as string;

    const itemRows = await sql`
      INSERT INTO order_items (
        order_id, film_id, cinema_id, room_id,
        rights_holder_account_id, screening_count,
        start_date, end_date,
        catalog_price, currency, platform_margin_rate, delivery_fees,
        commission_rate, displayed_price, rights_holder_amount,
        timeless_amount, delivery_status
      ) VALUES (
        ${orderId}, ${filmId}, ${cinemaId}, ${roomId},
        ${rhCtx.accountId}, 5,
        ${startDate}, ${endDate},
        15000, 'EUR', '0.20', 5000,
        '0', 18000, 15000, 3000,
        'pending'
      )
      RETURNING id
    `;
    orderItemId = itemRows[0]?.id as string;

    void orderItemId;
    await sql.end();
  });

  test("deliveries page shows pending items by default", async ({ page }) => {
    await loginAsAdmin(page, adminCtx);

    await page.getByRole("link", { name: "Deliveries" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/deliveries/, { timeout: 15000 });

    // The "To process" tab should be active by default
    await expect(page.getByRole("tab", { name: "To process" })).toHaveAttribute(
      "data-state",
      "active"
    );

    // The film title should be visible in the table
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 10000 });
  });

  test("admin can take over a delivery", async ({ page }) => {
    await loginAsAdmin(page, adminCtx);
    await page.goto("/en/admin/deliveries");
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 10000 });

    // Click "Take over" action button
    await page.getByTitle("Take over").first().click();

    // Fill in the dialog
    await expect(page.getByText("Take over delivery")).toBeVisible();
    await page.getByLabel("Lab order number").fill("LAB-E2E-001");
    await page.getByLabel("Internal notes").fill("DCP shipping initiated");

    // Confirm
    await page.getByRole("button", { name: "Take over" }).click();

    // Toast should confirm
    await expect(page.getByText("Delivery status updated")).toBeVisible({
      timeout: 10000,
    });
  });

  test("in-progress delivery appears in In progress tab", async ({ page }) => {
    await loginAsAdmin(page, adminCtx);
    await page.goto("/en/admin/deliveries");

    // Switch to "In progress" tab
    await page.getByRole("tab", { name: "In progress" }).click();

    // Film should be visible
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 10000 });

    // Lab order number should be displayed
    await expect(page.getByText("LAB-E2E-001")).toBeVisible();
  });

  test("admin can edit delivery notes", async ({ page }) => {
    await loginAsAdmin(page, adminCtx);
    await page.goto("/en/admin/deliveries");

    await page.getByRole("tab", { name: "In progress" }).click();
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 10000 });

    // Click "Edit notes" action button
    await page.getByTitle("Edit notes").first().click();

    // Update notes
    await expect(page.getByText("Edit delivery notes")).toBeVisible();
    await page.getByLabel("Internal notes").fill("DCP arrived at lab, processing");
    await page.getByLabel("Lab order number").fill("LAB-E2E-002");

    await page.getByRole("button", { name: "Save notes" }).click();

    await expect(page.getByText("Notes updated")).toBeVisible({ timeout: 10000 });
  });

  test("admin can mark delivery as delivered", async ({ page }) => {
    await loginAsAdmin(page, adminCtx);
    await page.goto("/en/admin/deliveries");

    await page.getByRole("tab", { name: "In progress" }).click();
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 10000 });

    // Click "Mark as delivered" button
    await page.getByTitle("Mark as delivered").first().click();

    await expect(page.getByText("Mark as delivered", { exact: false })).toBeVisible();
    await page.getByLabel("Internal notes").fill("KDM generated and sent");

    await page.getByRole("button", { name: "Mark delivered" }).click();

    await expect(page.getByText("Delivery status updated")).toBeVisible({
      timeout: 10000,
    });
  });

  test("delivered item appears in Delivered tab", async ({ page }) => {
    await loginAsAdmin(page, adminCtx);
    await page.goto("/en/admin/deliveries");

    await page.getByRole("tab", { name: "Delivered" }).click();

    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Delivered", { exact: true }).first()).toBeVisible();
  });

  test("search filters deliveries", async ({ page }) => {
    await loginAsAdmin(page, adminCtx);
    await page.goto("/en/admin/deliveries");

    // Switch to "All" tab to see all items
    await page.getByRole("tab", { name: "All" }).click();

    // Search by film title
    await page
      .getByPlaceholder("Search by film, cinema, order # or lab #")
      .fill(filmTitle);

    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 10000 });

    // Search for something that doesn't exist
    await page
      .getByPlaceholder("Search by film, cinema, order # or lab #")
      .fill("nonexistent-film-xyz");

    await expect(page.getByText("No deliveries found")).toBeVisible({
      timeout: 10000,
    });
  });

  test("order status transitions to delivered when all items are delivered", async () => {
    const sql = postgres(DB_URL, { max: 1 });

    const orders = await sql`
      SELECT status FROM orders WHERE id = ${orderId}
    `;

    expect(orders[0]?.status).toBe("delivered");

    await sql.end();
  });
});
