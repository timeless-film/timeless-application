/**
 * E2E API tests for Orders endpoints (E08-011).
 * Tests: checkout API, orders list, order detail, invoice endpoint.
 * Uses `request` fixture (no UI) — these are REST API tests.
 */
import { expect, test } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://timeless:timeless@localhost:5432/timeless_test";

const TEST_ID = Date.now().toString(36);

function uniqueSuffix() {
  return `${TEST_ID}-${randomBytes(4).toString("hex")}`;
}

test.describe("Orders API — E08-011", () => {
  let sql: ReturnType<typeof postgres>;
  let exhibitorToken: string;
  let exhibitorAccountId: string;
  let rightsHolderAccountId: string;
  let directFilmId: string;
  let cinemaId: string;
  let roomId: string;
  let orderId: string;
  let orderNumber: number;

  test.beforeAll(async () => {
    sql = postgres(DATABASE_URL, { max: 1 });

    // Create rights holder account (with Stripe Connect onboarded)
    const [rightsHolder] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, stripe_connect_account_id, stripe_connect_onboarding_complete)
      VALUES ('rights_holder', ${"RH Orders API " + uniqueSuffix()}, 'FR', true, ${"acct_test_" + uniqueSuffix()}, true)
      RETURNING id
    `;
    rightsHolderAccountId = rightsHolder!.id;

    // Create exhibitor account
    const [exhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, preferred_currency)
      VALUES ('exhibitor', ${"Cinema Orders API " + uniqueSuffix()}, 'FR', true, 'EUR')
      RETURNING id
    `;
    exhibitorAccountId = exhibitor!.id;

    // Create exhibitor user
    const [user] = await sql`
      INSERT INTO better_auth_users (id, email, email_verified, name, created_at, updated_at)
      VALUES (gen_random_uuid(), ${"orders-api-" + uniqueSuffix() + "@e2e-test.local"}, true, 'Orders API Tester', NOW(), NOW())
      RETURNING id
    `;

    // Link user to exhibitor account
    await sql`
      INSERT INTO account_members (account_id, user_id, role)
      VALUES (${exhibitorAccountId}, ${user!.id}, 'owner')
    `;

    // Create API token for auth
    const rawToken = `tmls_${randomBytes(20).toString("hex")}`;
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const tokenPrefix = rawToken.substring(0, 13);

    await sql`
      INSERT INTO api_tokens (account_id, token_hash, name, token_prefix, last_used_at)
      VALUES (${exhibitorAccountId}, ${tokenHash}, 'test-token', ${tokenPrefix}, NOW())
    `;
    exhibitorToken = rawToken;

    // Create direct film
    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rightsHolderAccountId}, ${"Orders API Film " + uniqueSuffix()}, 'direct', 'active', 1995)
      RETURNING id
    `;
    directFilmId = film!.id;

    // Create film price for France
    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${directFilmId}, ARRAY['FR'], 15000, 'EUR')
    `;

    // Create cinema
    const [cinema] = await sql`
      INSERT INTO cinemas (account_id, name, address, city, postal_code, country)
      VALUES (${exhibitorAccountId}, ${"Cinema " + uniqueSuffix()}, '10 Rue du Film', 'Paris', '75001', 'FR')
      RETURNING id
    `;
    cinemaId = cinema!.id;

    // Create room
    const [room] = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinemaId}, 'Salle Lumière', 200)
      RETURNING id
    `;
    roomId = room!.id;

    // Seed an order with order items (simulates post-payment state)
    const [order] = await sql`
      INSERT INTO orders (exhibitor_account_id, status, stripe_payment_intent_id, subtotal, tax_amount, total, currency, paid_at)
      VALUES (
        ${exhibitorAccountId},
        'paid',
        ${"pi_test_" + uniqueSuffix()},
        23000,
        4600,
        27600,
        'EUR',
        NOW()
      )
      RETURNING id, order_number
    `;
    orderId = order!.id;
    orderNumber = order!.order_number;

    await sql`
      INSERT INTO order_items (order_id, film_id, cinema_id, room_id, rights_holder_account_id, screening_count, catalog_price, platform_margin_rate, delivery_fees, commission_rate, displayed_price, rights_holder_amount, timeless_amount, currency)
      VALUES (
        ${orderId},
        ${directFilmId},
        ${cinemaId},
        ${roomId},
        ${rightsHolderAccountId},
        3,
        15000,
        '0.20',
        5000,
        '0.10',
        23000,
        13500,
        9500,
        'EUR'
      )
    `;
  });

  test.afterAll(async () => {
    await sql.end();
  });

  // ─── GET /api/v1/orders ─────────────────────────────────────────────────────

  test("GET /api/v1/orders returns paginated list", async ({ request }) => {
    const response = await request.get("/api/v1/orders", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(20);
    expect(body.pagination.total).toBeGreaterThanOrEqual(1);

    // Verify order structure
    const order = body.data.find((o: { id: string }) => o.id === orderId);
    expect(order).toBeDefined();
    expect(order.status).toBe("paid");
    expect(order.currency).toBe("EUR");
    expect(order.items).toBeDefined();
    expect(order.items.length).toBe(1);
  });

  test("GET /api/v1/orders returns empty list when no orders match status", async ({
    request,
  }) => {
    const response = await request.get("/api/v1/orders?status=refunded", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  test("GET /api/v1/orders filters by status", async ({ request }) => {
    const response = await request.get("/api/v1/orders?status=paid", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    for (const order of body.data) {
      expect(order.status).toBe("paid");
    }
  });

  test("GET /api/v1/orders respects pagination", async ({ request }) => {
    const response = await request.get("/api/v1/orders?page=1&limit=1", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.length).toBeLessThanOrEqual(1);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(1);
  });

  test("GET /api/v1/orders returns 401 without auth", async ({ request }) => {
    const response = await request.get("/api/v1/orders");
    expect(response.status()).toBe(401);
  });

  // ─── GET /api/v1/orders/[orderId] ───────────────────────────────────────────

  test("GET /api/v1/orders/:id returns order detail", async ({ request }) => {
    const response = await request.get(`/api/v1/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.data.id).toBe(orderId);
    expect(body.data.orderNumber).toBe(orderNumber);
    expect(body.data.status).toBe("paid");
    expect(body.data.subtotal).toBe(23000);
    expect(body.data.taxAmount).toBe(4600);
    expect(body.data.total).toBe(27600);
    expect(body.data.currency).toBe("EUR");

    // Verify items
    expect(body.data.items).toBeDefined();
    expect(body.data.items.length).toBe(1);
    const item = body.data.items[0];
    expect(item.filmId).toBe(directFilmId);
    expect(item.screeningCount).toBe(3);
    expect(item.displayedPrice).toBe(23000);
    expect(item.film).toBeDefined();
    expect(item.cinema).toBeDefined();
    expect(item.room).toBeDefined();
  });

  test("GET /api/v1/orders/:id returns 404 for nonexistent order", async ({
    request,
  }) => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const response = await request.get(`/api/v1/orders/${fakeId}`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("GET /api/v1/orders/:id returns 404 for another exhibitor's order", async ({
    request,
  }) => {
    // Create another exhibitor with an order
    const [otherExhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('exhibitor', ${"Other Cinema " + uniqueSuffix()}, 'FR', true)
      RETURNING id
    `;

    const [otherOrder] = await sql`
      INSERT INTO orders (exhibitor_account_id, status, stripe_payment_intent_id, subtotal, tax_amount, total, currency, paid_at)
      VALUES (${otherExhibitor!.id}, 'paid', ${"pi_other_" + uniqueSuffix()}, 10000, 0, 10000, 'EUR', NOW())
      RETURNING id
    `;

    // Try to access with our token — should get 404 (not 403, by design)
    const response = await request.get(`/api/v1/orders/${otherOrder!.id}`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(404);
  });

  test("GET /api/v1/orders/:id returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.get(`/api/v1/orders/${orderId}`);
    expect(response.status()).toBe(401);
  });

  // ─── GET /api/v1/orders/:id/invoice ─────────────────────────────────────────

  test("GET /api/v1/orders/:id/invoice returns 404 when no invoice", async ({
    request,
  }) => {
    // Our seeded order has no stripeInvoiceId
    const response = await request.get(`/api/v1/orders/${orderId}/invoice`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toContain("invoice");
  });

  test("GET /api/v1/orders/:id/invoice returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.get(`/api/v1/orders/${orderId}/invoice`);
    expect(response.status()).toBe(401);
  });

  // ─── POST /api/v1/cart/checkout ─────────────────────────────────────────────

  test("POST /api/v1/cart/checkout returns 400 when cart is empty", async ({
    request,
  }) => {
    // Cart is empty by default
    const response = await request.post("/api/v1/cart/checkout", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("CART_EMPTY");
  });

  test("POST /api/v1/cart/checkout returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.post("/api/v1/cart/checkout");
    expect(response.status()).toBe(401);
  });

  test("POST /api/v1/cart/checkout returns 403 for rights holder account", async ({
    request,
  }) => {
    // Create a RH API token
    const rhRawToken = `tmls_${randomBytes(20).toString("hex")}`;
    const rhTokenHash = createHash("sha256").update(rhRawToken).digest("hex");
    const rhTokenPrefix = rhRawToken.substring(0, 13);

    await sql`
      INSERT INTO api_tokens (account_id, token_hash, name, token_prefix, last_used_at)
      VALUES (${rightsHolderAccountId}, ${rhTokenHash}, 'rh-test-token', ${rhTokenPrefix}, NOW())
    `;

    const response = await request.post("/api/v1/cart/checkout", {
      headers: { Authorization: `Bearer ${rhRawToken}` },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  test("POST /api/v1/cart/checkout returns 400 when RH not onboarded", async ({
    request,
  }) => {
    // Create a RH account WITHOUT Stripe onboarding
    const [notOnboardedRh] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, stripe_connect_onboarding_complete)
      VALUES ('rights_holder', ${"Not Onboarded RH " + uniqueSuffix()}, 'FR', true, false)
      RETURNING id
    `;

    // Create a film for this RH
    const [notOnboardedFilm] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${notOnboardedRh!.id}, ${"Not Onboarded Film " + uniqueSuffix()}, 'direct', 'active', 2000)
      RETURNING id
    `;

    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${notOnboardedFilm!.id}, ARRAY['FR'], 10000, 'EUR')
    `;

    // Add to cart
    await sql`
      INSERT INTO cart_items (exhibitor_account_id, film_id, cinema_id, room_id, screening_count)
      VALUES (${exhibitorAccountId}, ${notOnboardedFilm!.id}, ${cinemaId}, ${roomId}, 1)
    `;

    const response = await request.post("/api/v1/cart/checkout", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("RIGHTS_HOLDER_NOT_ONBOARDED");

    // Cleanup cart
    await sql`DELETE FROM cart_items WHERE exhibitor_account_id = ${exhibitorAccountId}`;
  });
});
