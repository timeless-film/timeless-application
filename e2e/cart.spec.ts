import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { createHash, randomBytes } from "node:crypto";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://timeless:timeless@localhost:5432/timeless_test";

test.describe("Cart functionality", () => {
  let sql: ReturnType<typeof postgres>;
  let exhibitorToken: string;
  let exhibitorAccountId: string;
  let rightsHolderAccountId: string;
  let directFilmId: string;
  let cinemaId: string;
  let roomId: string;

  test.beforeAll(async () => {
    sql = postgres(DATABASE_URL, { max: 1 });

    // Create rights holder account
    const [rightsHolder] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('rights_holder', 'Test RH Cart', 'US', true)
      RETURNING id
    `;
    rightsHolderAccountId = rightsHolder!.id;

    // Create exhibitor account
    const [exhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('exhibitor', 'Test Cinema Cart', 'US', true)
      RETURNING id
    `;
    exhibitorAccountId = exhibitor!.id;

    // Create exhibitor user with unique email
    const uniqueSuffix = Date.now().toString(36) + randomBytes(4).toString("hex");
    const [user] = await sql`
      INSERT INTO better_auth_users (id, email, email_verified, name, created_at, updated_at)
      VALUES (gen_random_uuid(), ${'exhibitor-cart-' + uniqueSuffix + '@e2e-test.local'}, true, 'Cart Tester', NOW(), NOW())
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
      VALUES (${rightsHolderAccountId}, 'Cart Test Film', 'direct', 'active', 2000)
      RETURNING id
    `;
    directFilmId = film!.id;

    // Create film price for US
    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${directFilmId}, ARRAY['US'], 10000, 'USD')
    `;

    // Create cinema
    const [cinema] = await sql`
      INSERT INTO cinemas (account_id, name, address, city, postal_code, country)
      VALUES (${exhibitorAccountId}, 'Test Cinema', '123 Main St', 'New York', '10001', 'US')
      RETURNING id
    `;
    cinemaId = cinema!.id;

    // Create room
    const [room] = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinemaId}, 'Screen 1', 100)
      RETURNING id
    `;
    roomId = room!.id;
  });

  test.afterAll(async () => {
    await sql.end();
  });

  test.beforeEach(async () => {
    // Clear cart before each test
    await sql`DELETE FROM cart_items WHERE exhibitor_account_id = ${exhibitorAccountId}`;
  });

  test("Add item to cart successfully", async ({ request }) => {
    const response = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId,
        roomId,
        quantity: 2,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data).toEqual({ success: true });

    // Verify item in cart
    const items = await sql`
      SELECT * FROM cart_items
      WHERE exhibitor_account_id = ${exhibitorAccountId}
      AND film_id = ${directFilmId}
    `;
    expect(items.length).toBe(1);
    expect(items[0]!.screening_count).toBe(2);
  });

  test("Add multiple items to cart", async ({ request }) => {
    // Add first item
    await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId,
        roomId,
        quantity: 1,
      },
    });

    // Add second item (duplicate allowed in E06)
    const response2 = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId,
        roomId,
        quantity: 3,
      },
    });

    expect(response2.status()).toBe(201);

    // Verify both items in cart
    const items = await sql`
      SELECT * FROM cart_items
      WHERE exhibitor_account_id = ${exhibitorAccountId}
    `;
    expect(items.length).toBe(2);
  });

  test("Get cart summary", async ({ request }) => {
    // Add item to cart
    await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId,
        roomId,
        quantity: 2,
      },
    });

    // Get cart summary
    const response = await request.get("/api/v1/cart", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.totalItems).toBe(1);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]!.filmTitle).toBe("Cart Test Film");
    expect(body.data.items[0]!.screeningCount).toBe(2);
    expect(body.data.total).toBeDefined();
    expect(body.data.currency).toBeDefined();
  });

  test("Cart requires authentication", async ({ request }) => {
    const response = await request.post("/api/v1/cart/items", {
      // No Authorization header
      data: {
        filmId: directFilmId,
        cinemaId,
        roomId,
        quantity: 1,
      },
    });

    expect(response.status()).toBe(401);
  });

  test("Cannot add item with invalid cinema", async ({ request }) => {
    const response = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId: "00000000-0000-0000-0000-000000000000",
        roomId,
        quantity: 1,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_CINEMA");
  });

  test("Cannot add item with invalid room", async ({ request }) => {
    const response = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId,
        roomId: "00000000-0000-0000-0000-000000000000",
        quantity: 1,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_ROOM");
  });

  test("Validates date range (endDate requires startDate)", async ({ request }) => {
    const response = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId,
        roomId,
        quantity: 1,
        endDate: "2026-12-31",
        // Missing startDate
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_DATE_RANGE");
  });

  test("Validates date range (endDate < startDate)", async ({ request }) => {
    const response = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId,
        roomId,
        quantity: 1,
        startDate: "2026-12-31",
        endDate: "2026-06-01",
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_DATE_RANGE");
  });

  test("Cart persists across sessions", async ({ request }) => {
    // Add item
    await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId,
        roomId,
        quantity: 1,
      },
    });

    // Simulate new session - get cart again
    const response = await request.get("/api/v1/cart", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.totalItems).toBe(1);
  });

  test("Empty cart returns zero items", async ({ request }) => {
    const response = await request.get("/api/v1/cart", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.totalItems).toBe(0);
    expect(body.data.items).toHaveLength(0);
  });
});
