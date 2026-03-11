/**
 * E2E tests for Orders page (E06 + E08).
 * Tests: page access, empty state, orders list with seeded data, order detail.
 */
import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import postgres from "postgres";

import { setupExhibitor } from "./helpers/exhibitor";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://timeless:timeless@localhost:5432/timeless_test";

test.describe("Orders page", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/en/orders");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("shows empty state when no orders exist", async ({ page, request }) => {
    await setupExhibitor(page, request, "orders-empty");

    await page.goto("/en/orders");
    await expect(page).toHaveURL(/\/en\/orders/);

    // The page should load and show a heading
    await expect(page.getByRole("heading", { name: /order history/i })).toBeVisible({ timeout: 15000 });

    // With no orders, should display empty state
    await expect(page.getByText(/order history.*0/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Orders page — with seeded orders", () => {
  let sql: ReturnType<typeof postgres>;
  let orderId: string;
  let orderNumber: number;
  let filmTitle: string;
  let cinemaName: string;

  test.beforeAll(async () => {
    sql = postgres(DATABASE_URL, { max: 1 });
  });

  test.afterAll(async () => {
    await sql.end();
  });

  test("shows orders list and navigates to detail", async ({ page, request }) => {
    // Setup exhibitor via UI (creates account, user, cinema)
    const { companyName, cinemaName: setupCinemaName } = await setupExhibitor(
      page,
      request,
      "orders-list"
    );
    cinemaName = setupCinemaName;

    // Find the exhibitor's account in DB
    const [exhibitorAccount] = await sql`
      SELECT id FROM accounts WHERE company_name = ${companyName}
    `;
    const exhibitorAccountId = exhibitorAccount!.id;

    // Find the cinema and room created during onboarding
    const [cinema] = await sql`
      SELECT id FROM cinemas WHERE account_id = ${exhibitorAccountId} LIMIT 1
    `;
    const [room] = await sql`
      SELECT id FROM rooms WHERE cinema_id = ${cinema!.id} LIMIT 1
    `;

    // Create a rights holder and film
    const uniqueSuffix = randomBytes(4).toString("hex");
    const [rh] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('rights_holder', ${"RH Orders " + uniqueSuffix}, 'FR', true)
      RETURNING id
    `;

    filmTitle = `Test Film ${uniqueSuffix}`;
    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rh!.id}, ${filmTitle}, 'direct', 'active', 1960)
      RETURNING id
    `;

    // Seed an order with items
    const [order] = await sql`
      INSERT INTO orders (exhibitor_account_id, status, stripe_payment_intent_id, subtotal, tax_amount, total, currency, paid_at)
      VALUES (${exhibitorAccountId}, 'paid', ${"pi_test_ui_" + uniqueSuffix}, 23000, 4600, 27600, 'EUR', NOW())
      RETURNING id, order_number
    `;
    orderId = order!.id;
    orderNumber = order!.order_number;

    await sql`
      INSERT INTO order_items (order_id, film_id, cinema_id, room_id, rights_holder_account_id, screening_count, catalog_price, platform_margin_rate, delivery_fees, commission_rate, displayed_price, rights_holder_amount, timeless_amount, currency)
      VALUES (${orderId}, ${film!.id}, ${cinema!.id}, ${room!.id}, ${rh!.id}, 2, 15000, '0.20', 5000, '0.10', 23000, 13500, 9500, 'EUR')
    `;

    // Navigate to orders page
    await page.goto("/en/orders");
    await expect(page).toHaveURL(/\/en\/orders/);
    await expect(
      page.getByRole("heading", { name: /order history/i })
    ).toBeVisible({ timeout: 15000 });

    // Verify the order appears in the list
    const orderRef = `ORD-${String(orderNumber).padStart(6, "0")}`;
    await expect(page.getByText(orderRef)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(filmTitle)).toBeVisible();

    // Click the detail button (Eye icon link)
    const orderRow = page.getByRole("row").filter({ hasText: orderRef });
    const detailLink = orderRow.getByRole("link");
    await detailLink.click();

    // Verify detail page
    await expect(page).toHaveURL(new RegExp(`/en/orders/${orderId}`));
    await expect(
      page.getByRole("heading", { name: new RegExp(orderRef) })
    ).toBeVisible({ timeout: 15000 });

    // Verify film and pricing details
    await expect(page.getByText(filmTitle)).toBeVisible();
    await expect(page.getByText(/paid/i)).toBeVisible();
  });
});
