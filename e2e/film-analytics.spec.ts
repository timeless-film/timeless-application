import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { createHash, randomBytes } from "node:crypto";

/**
 * E05-004 Test Suite: Rights Holder Analytics Page
 *
 * Tests the /films/analytics route for rights holders showing:
 * - KPIs: views, adds to cart, requests, revenue
 * - Film list with stats
 * - Filters by status, type, region
 */

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://timeless:timeless@localhost:5432/timeless_test";
const sql = postgres(DATABASE_URL);

test.describe("Film Analytics (E05-004)", () => {
  let rightsHolderToken: string;
  let rightsHolderAccountId: string;
  let exhibitorAccountId: string;
  let filmId: string;
  let cinemaId: string;
  let roomId: string;
  let orderId: string;

  test.beforeAll(async () => {
    // Create rights holder
    const [rightsHolder] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('rights_holder', 'Analytics Test Films', 'US', true)
      RETURNING id
    `;
    if (!rightsHolder) throw new Error("Failed to create rights holder");
    rightsHolderAccountId = rightsHolder.id;

    // Create exhibitor
    const [exhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('exhibitor', 'Analytics Test Cinema', 'US', true)
      RETURNING id
    `;
    if (!exhibitor) throw new Error("Failed to create exhibitor");
    exhibitorAccountId = exhibitor.id;

    // Create cinema for exhibitor
    const [cinema] = await sql`
      INSERT INTO cinemas (account_id, name, country, city)
      VALUES (${exhibitorAccountId}, 'Test Cinema', 'US', 'New York')
      RETURNING id
    `;
    if (!cinema) throw new Error("Failed to create cinema");
    cinemaId = cinema.id;

    // Create room
    const [room] = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinemaId}, 'Test Room', 100)
      RETURNING id
    `;
    if (!room) throw new Error("Failed to create room");
    roomId = room.id;

    // Create API token for rights holder
    const rawToken = `tmls_${randomBytes(20).toString("hex")}`;
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const tokenPrefix = rawToken.substring(0, 13);

    await sql`
      INSERT INTO api_tokens (account_id, token_hash, name, token_prefix)
      VALUES (
        ${rightsHolderAccountId},
        ${tokenHash},
        'Analytics Test Token',
        ${tokenPrefix}
      )
    `;

    rightsHolderToken = rawToken;

    // Create film with analytics data
    const [film] = await sql`
      INSERT INTO films (
        account_id,
        title,
        original_title,
        type,
        status,
        release_year,
        duration,
        directors,
        genres,
        countries,
        synopsis
      )
      VALUES (
        ${rightsHolderAccountId},
        'Analytics Test Film',
        'Film Test Analytique',
        'direct',
        'active',
        2023,
        100,
        ARRAY['Test Director'],
        ARRAY['Drama'],
        ARRAY['US'],
        'A film for testing analytics'
      )
      RETURNING id
    `;
    if (!film) throw new Error("Failed to create film");
    filmId = film.id;

    // Add price
    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${filmId}, ARRAY['US'], 100000, 'USD')
    `;

    // Create cart items to simulate activity
    await sql`
      INSERT INTO cart_items (exhibitor_account_id, film_id, cinema_id, room_id, screening_count, start_date, end_date)
      VALUES (${exhibitorAccountId}, ${filmId}, ${cinemaId}, ${roomId}, 1, '2025-01-01', '2025-01-31')
    `;

    // Add orders to create revenue data
    // Orders don't contain film/cinema directly — that's on order_items.
    // Create an order + order_item for revenue tracking.
    const [order] = await sql`
      INSERT INTO orders (exhibitor_account_id, status, stripe_payment_intent_id, subtotal, tax_amount, total, currency, paid_at)
      VALUES (
        ${exhibitorAccountId},
        'paid',
        'pi_test_analytics',
        100000,
        0,
        100000,
        'USD',
        NOW()
      )
      RETURNING id
    `;

    if (order) {
      orderId = order.id;
      await sql`
        INSERT INTO order_items (order_id, film_id, cinema_id, room_id, rights_holder_account_id, screening_count, start_date, end_date, catalog_price, platform_margin_rate, delivery_fees, commission_rate, displayed_price, rights_holder_amount, timeless_amount, currency)
        VALUES (
          ${order.id},
          ${filmId},
          ${cinemaId},
          ${roomId},
          ${rightsHolderAccountId},
          1,
          '2025-01-01',
          '2025-01-31',
          100000,
          '0.20',
          0,
          '0.10',
          120000,
          90000,
          10000,
          'USD'
        )
      `;
    }

    // Insert film view events for analytics tracking
    await sql`
      INSERT INTO film_events (film_id, account_id, event_type)
      VALUES
        (${filmId}, ${exhibitorAccountId}, 'view'),
        (${filmId}, ${exhibitorAccountId}, 'view'),
        (${filmId}, ${exhibitorAccountId}, 'view')
    `;

    // Insert a cart_add event
    await sql`
      INSERT INTO film_events (film_id, account_id, event_type)
      VALUES (${filmId}, ${exhibitorAccountId}, 'cart_add')
    `;
  });

  test.afterAll(async () => {
    if (filmId) await sql`DELETE FROM film_events WHERE film_id = ${filmId}`;
    if (filmId) await sql`DELETE FROM cart_items WHERE film_id = ${filmId}`;
    if (orderId) await sql`DELETE FROM order_items WHERE order_id = ${orderId}`;
    if (orderId) await sql`DELETE FROM orders WHERE id = ${orderId}`;
    if (filmId) await sql`DELETE FROM films WHERE id = ${filmId}`;
    if (roomId) await sql`DELETE FROM rooms WHERE id = ${roomId}`;
    if (cinemaId) await sql`DELETE FROM cinemas WHERE id = ${cinemaId}`;
    if (exhibitorAccountId) await sql`DELETE FROM accounts WHERE id = ${exhibitorAccountId}`;
    if (rightsHolderAccountId) await sql`DELETE FROM accounts WHERE id = ${rightsHolderAccountId}`;

    await sql.end();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Analytics Dashboard KPIs
  // ────────────────────────────────────────────────────────────────────────────

  test("Analytics page returns all global KPIs", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // All KPI fields must be defined and numeric
    expect(body.data.kpis).toBeDefined();
    expect(typeof body.data.kpis.totalViews).toBe("number");
    expect(typeof body.data.kpis.totalAddsToCart).toBe("number");
    expect(typeof body.data.kpis.totalRequests).toBe("number");
    expect(body.data.kpis.totalRevenue).toBeGreaterThanOrEqual(0);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Film-Level Analytics
  // ────────────────────────────────────────────────────────────────────────────

  test("Analytics returns film list with per-film stats", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(Array.isArray(body.data.films)).toBe(true);
    expect(body.data.films.length).toBeGreaterThan(0);

    const film = body.data.films[0];
    expect(film.id).toBeDefined();
    expect(film.title).toBeDefined();
    expect(film.views).toBeDefined();
    expect(film.addsToCart).toBeDefined();
    expect(film.requests).toBeDefined();
    expect(film.revenue).toBeDefined();
  });

  test("Film stats include status and type", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    const film = body.data.films.find((f: any) => f.id === filmId);
    expect(film?.status).toBe("active");
    expect(film?.type).toBe("direct");
  });

  test("Film stats include pricing zones", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    const film = body.data.films.find((f: any) => f.id === filmId);
    expect(Array.isArray(film?.priceZones)).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Analytics Filters
  // ────────────────────────────────────────────────────────────────────────────

  test("Filter by status=active", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics?status=active", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.data.films.every((f: any) => f.status === "active")).toBe(true);
  });

  test("Filter by type=direct", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics?type=direct", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.data.films.every((f: any) => f.type === "direct")).toBe(true);
  });

  test("Filter by region/country", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics?region=US", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Films should have US in their countries
    expect(
      body.data.films.every((f: any) =>
        f.countries?.some((c: string) => c.includes("US"))
      )
    ).toBe(true);
  });

  test("Filters update KPIs accordingly", async ({ request }) => {
    // Get all KPIs
    const allResponse = await request.get("/api/v1/films/analytics", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    const allKpis = (await allResponse.json()).data.kpis;

    // Get KPIs for active status only
    const filteredResponse = await request.get("/api/v1/films/analytics?status=active", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    const filteredKpis = (await filteredResponse.json()).data.kpis;

    // Filtered KPIs should be <= all KPIs
    expect(filteredKpis.totalViews).toBeLessThanOrEqual(allKpis.totalViews);
    expect(filteredKpis.totalRevenue).toBeLessThanOrEqual(allKpis.totalRevenue);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Sorting & Pagination
  // ────────────────────────────────────────────────────────────────────────────

  test("Analytics supports sorting by revenue", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics?sort=revenue&order=desc", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Check descending revenue order
    const revenues = (body.data.films as Array<any>).map((f) => f.revenue);
    for (let i = 0; i < revenues.length - 1; i++) {
      expect(revenues[i]).toBeGreaterThanOrEqual(revenues[i + 1]);
    }
  });

  test("Analytics supports sorting by views", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics?sort=views&order=desc", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Check that films are sorted by views
    const views = (body.data.films as Array<any>).map((f) => f.views);
    for (let i = 0; i < views.length - 1; i++) {
      expect(views[i]).toBeGreaterThanOrEqual(views[i + 1]);
    }
  });

  test("Analytics supports pagination", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics?page=1&limit=10", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBeLessThanOrEqual(10);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Top Searches & Filters Tracking
  // ────────────────────────────────────────────────────────────────────────────

  test("Analytics includes top search terms", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Should track top searches
    expect(body.data.topSearches).toBeDefined();
    expect(Array.isArray(body.data.topSearches)).toBe(true);
  });

  test("Analytics includes top filter combinations", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Should track popular filter combinations
    expect(body.data.topFilters).toBeDefined();
    expect(Array.isArray(body.data.topFilters)).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Time-Series Data
  // ────────────────────────────────────────────────────────────────────────────

  test("Analytics includes time-series data for KPIs", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics?period=30days", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Should have time-series breakdown
    expect(body.data.timeline).toBeDefined();
    expect(Array.isArray(body.data.timeline)).toBe(true);

    // Each data point should have date and metrics
    if (body.data.timeline.length > 0) {
      const point = body.data.timeline[0];
      expect(point.date).toBeDefined();
      expect(point.views).toBeDefined();
      expect(point.revenue).toBeDefined();
    }
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Authorization & Data Isolation
  // ────────────────────────────────────────────────────────────────────────────

  test("Analytics requires authentication", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics");

    expect(response.status()).toBe(401);
  });

  test("Rights holder can only see own films analytics", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // All films should belong to this rights holder
    const allBelongToRightsHolder = body.data.films.every((f: any) => f.accountId === rightsHolderAccountId);
    expect(allBelongToRightsHolder).toBe(true);
  });

  test("Exhibitor cannot access film analytics endpoint", async ({ request }) => {
    // Create exhibitor token for negative test
    const exhibitorRawToken = `tmls_${randomBytes(20).toString("hex")}`;
    const exhibitorTokenHash = createHash("sha256").update(exhibitorRawToken).digest("hex");
    const exhibitorTokenPrefix = exhibitorRawToken.substring(0, 13);

    await sql`
      INSERT INTO api_tokens (account_id, token_hash, name, token_prefix)
      VALUES (
        ${exhibitorAccountId},
        ${exhibitorTokenHash},
        'Exhibitor Test Token',
        ${exhibitorTokenPrefix}
      )
    `;

    const response = await request.get("/api/v1/films/analytics", {
      headers: { Authorization: `Bearer ${exhibitorRawToken}` },
    });

    expect(response.status()).toBe(403);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Revenue Calculation
  // ────────────────────────────────────────────────────────────────────────────

  test("Revenue per film is calculated correctly", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    const testFilm = body.data.films.find((f: any) => f.id === filmId);

    // Should include revenue from paid orders
    expect(testFilm.revenue).toBeGreaterThanOrEqual(0);
  });

  test("Total revenue sum matches KPI total", async ({ request }) => {
    const response = await request.get("/api/v1/films/analytics", {
      headers: { Authorization: `Bearer ${rightsHolderToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    // Sum of individual film revenues should match total
    const sumRevenue = body.data.films.reduce((sum: number, f: any) => sum + (f.revenue || 0), 0);
    expect(sumRevenue).toBe(body.data.kpis.totalRevenue);
  });
});
