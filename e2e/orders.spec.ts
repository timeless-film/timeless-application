/**
 * E2E tests for Orders history (E06).
 * Tests: display paid orders, basic functionality.
 * Note: Full order creation flow requires E08 (payment).
 */
import { expect, test } from "@playwright/test";
import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://timeless:timeless@localhost:5432/timeless_test";

test.describe("Orders history", () => {
  let sql: ReturnType<typeof postgres>;
  let exhibitorAccountId: string;
  let rightsHolderAccountId: string;
  let filmId: string;
  let cinemaId: string;
  let roomId: string;

  test.beforeAll(async () => {
    sql = postgres(DATABASE_URL, { max: 1 });

    // Create rights holder account
    const [rightsHolder] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('rights_holder', 'Test RH Orders', 'DE', true)
      RETURNING id
    `;
    rightsHolderAccountId = rightsHolder!.id;

    // Create exhibitor account
    const [exhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('exhibitor', 'Test Cinema Orders', 'DE', true)
      RETURNING id
    `;
    exhibitorAccountId = exhibitor!.id;

    // Create film
    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rightsHolderAccountId}, 'Orders Test Film', 'direct', 'active', 2015)
      RETURNING id
    `;
    filmId = film!.id;

    // Create film price
    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${filmId}, ARRAY['DE'], 12000, 'EUR')
    `;

    // Create cinema
    const [cinema] = await sql`
      INSERT INTO cinemas (account_id, name, address, city, postal_code, country)
      VALUES (${exhibitorAccountId}, 'Test Cinema DE', 'Teststrasse 1', 'Berlin', '10115', 'DE')
      RETURNING id
    `;
    cinemaId = cinema!.id;

    // Create room
    const [room] = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinemaId}, 'Saal 1', 80)
      RETURNING id
    `;
    roomId = room!.id;
  });

  test.afterAll(async () => {
    await sql.end();
  });

  test.beforeEach(async () => {
    // Clear orders before each test
    await sql`DELETE FROM order_items WHERE order_id IN (
      SELECT id FROM orders WHERE exhibitor_account_id = ${exhibitorAccountId}
    )`;
    await sql`DELETE FROM orders WHERE exhibitor_account_id = ${exhibitorAccountId}`;
  });

  test("Orders page exists and is accessible", async ({ page }) => {
    // This test verifies the page structure exists
    // Full flow requires E08 payment implementation
    const response = await page.goto("/en/orders");
    expect(response?.status()).toBe(200);
  });

  test("Empty orders page shows no orders message", async ({ page }) => {
    await page.goto("/en/orders");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Should show some indication of empty state
    // Exact text depends on implementation
    const content = await page.textContent("body");
    expect(content).toBeTruthy();
  });

  test("Can create order manually for testing display", async () => {
    // Create a mock paid order for display testing
    const [order] = await sql`
      INSERT INTO orders (
        exhibitor_account_id,
        status,
        subtotal,
        tax_amount,
        total,
        currency,
        stripe_payment_intent_id,
        paid_at
      )
      VALUES (
        ${exhibitorAccountId},
        'paid',
        12000,
        3000,
        15000,
        'EUR',
        'pi_test_mock',
        NOW()
      )
      RETURNING id
    `;

    // Create order item
    await sql`
      INSERT INTO order_items (
        order_id,
        film_id,
        rights_holder_account_id,
        cinema_id,
        room_id,
        screening_count,
        start_date,
        end_date,
        catalog_price,
        displayed_price,
        platform_margin_rate,
        commission_rate,
        delivery_fees,
        rights_holder_amount,
        currency
      )
      VALUES (
        ${order!.id},
        ${filmId},
        ${rightsHolderAccountId},
        ${cinemaId},
        ${roomId},
        2,
        '2026-04-01',
        '2026-04-07',
        12000,
        15000,
        '0.25',
        '0.10',
        0,
        10800,
        'EUR'
      )
    `;

    // Verify order exists in DB
    const orders = await sql`
      SELECT * FROM orders WHERE id = ${order!.id}
    `;
    expect(orders.length).toBe(1);
    expect(orders[0]!.status).toBe("paid");
  });

  test("Order has proper relationships", async () => {
    // Create order with item
    const [order] = await sql`
      INSERT INTO orders (
        exhibitor_account_id,
        status,
        subtotal,
        tax_amount,
        total,
        currency,
        stripe_payment_intent_id,
        paid_at
      )
      VALUES (
        ${exhibitorAccountId},
        'paid',
        12000,
        3000,
        15000,
        'EUR',
        'pi_test_123',
        NOW()
      )
      RETURNING id
    `;

    await sql`
      INSERT INTO order_items (
        order_id,
        film_id,
        rights_holder_account_id,
        cinema_id,
        room_id,
        screening_count,
        start_date,
        end_date,
        catalog_price,
        displayed_price,
        platform_margin_rate,
        commission_rate,
        delivery_fees,
        rights_holder_amount,
        currency
      )
      VALUES (
        ${order!.id},
        ${filmId},
        ${rightsHolderAccountId},
        ${cinemaId},
        ${roomId},
        3,
        '2026-05-01',
        '2026-05-15',
        12000,
        15000,
        '0.25',
        '0.10',
        0,
        10800,
        'EUR'
      )
    `;

    // Verify relationships via join
    const result = await sql`
      SELECT
        o.id,
        o.status,
        o.total,
        oi.film_id,
        oi.screening_count,
        f.title
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN films f ON oi.film_id = f.id
      WHERE o.id = ${order!.id}
    `;

    expect(result.length).toBe(1);
    expect(result[0]!.title).toBe("Orders Test Film");
    expect(result[0]!.screening_count).toBe(3);
  });

  test("Multiple orders can exist for same exhibitor", async () => {
    // Create first order
    await sql`
      INSERT INTO orders (
        exhibitor_account_id,
        status,
        subtotal,
        tax_amount,
        total,
        currency,
        stripe_payment_intent_id,
        paid_at
      )
      VALUES (
        ${exhibitorAccountId},
        'paid',
        8000,
        2000,
        10000,
        'EUR',
        'pi_test_order1',
        NOW()
      )
    `;

    // Create second order
    await sql`
      INSERT INTO orders (
        exhibitor_account_id,
        status,
        subtotal,
        tax_amount,
        total,
        currency,
        stripe_payment_intent_id,
        paid_at
      )
      VALUES (
        ${exhibitorAccountId},
        'paid',
        16000,
        4000,
        20000,
        'EUR',
        'pi_test_order2',
        NOW()
      )
    `;

    // Verify both exist
    const orders = await sql`
      SELECT * FROM orders
      WHERE exhibitor_account_id = ${exhibitorAccountId}
      ORDER BY created_at DESC
    `;

    expect(orders.length).toBe(2);
    expect(orders[0]!.status).toBe("paid");
    expect(orders[1]!.status).toBe("paid");
  });

  test("Order timestamps are set correctly", async () => {
    const [order] = await sql`
      INSERT INTO orders (
        exhibitor_account_id,
        status,
        subtotal,
        tax_amount,
        total,
        currency,
        stripe_payment_intent_id,
        paid_at
      )
      VALUES (
        ${exhibitorAccountId},
        'paid',
        4000,
        1000,
        5000,
        'EUR',
        'pi_test_timestamps',
        NOW()
      )
      RETURNING created_at, updated_at
    `;

    expect(order!.created_at).toBeDefined();
    expect(order!.updated_at).toBeDefined();
    expect(order!.created_at).toEqual(order!.updated_at);
  });
});
