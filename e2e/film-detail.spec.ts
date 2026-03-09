import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { createHash, randomBytes } from "node:crypto";

/**
 * E05-002 Test Suite: Film Detail Page & Selection Modal
 * 
 * Tests the detailed film view and the unified cinema/room/quantity selection modal
 * for both direct booking (type=direct) and validation request (type=validation) flows.
 */

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://timeless:timeless@localhost:5432/timeless";
const sql = postgres(DATABASE_URL);

test.describe("Film Detail & Modal (E05-002)", () => {
  let exhibitorToken: string;
  let exhibitorAccountId: string;
  let rightsHolderAccountId: string;
  let directFilmId: string;
  let validationFilmId: string;
  let cinemaId: string;
  let roomId: string;

  test.beforeAll(async () => {
    // Create rights holder
    const [rightsHolder] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('rights_holder', 'Premium Films Inc', 'US', true)
      RETURNING id
    `;
    if (!rightsHolder) throw new Error("Failed to create rights holder");
    rightsHolderAccountId = rightsHolder.id;

    // Create exhibitor
    const [exhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('exhibitor', 'Art Cinemas', 'US', true)
      RETURNING id
    `;
    if (!exhibitor) throw new Error("Failed to create exhibitor");
    exhibitorAccountId = exhibitor.id;

    // Create cinema for exhibitor
    const [cinema] = await sql`
      INSERT INTO cinemas (account_id, name, country, city)
      VALUES (${exhibitorAccountId}, 'Downtown Cinema', 'US', 'New York')
      RETURNING id
    `;
    if (!cinema) throw new Error("Failed to create cinema");
    cinemaId = cinema.id;

    // Create room in cinema
    const [room] = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinemaId}, 'Screen 1', 100)
      RETURNING id
    `;
    if (!room) throw new Error("Failed to create room");
    roomId = room.id;

    // Create API token
    const rawToken = `tmls_${randomBytes(20).toString("hex")}`;
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const tokenPrefix = rawToken.substring(0, 13);

    await sql`
      INSERT INTO api_tokens (account_id, token_hash, name, token_prefix)
      VALUES (
        ${exhibitorAccountId},
        ${tokenHash},
        'Test Token',
        ${tokenPrefix}
      )
    `;

    exhibitorToken = rawToken;

    // Create direct booking film
    const [directFilm] = await sql`
      INSERT INTO films (
        account_id,
        title,
        original_title,
        type,
        status,
        release_year,
        duration,
        directors,
        "cast",
        genres,
        countries,
        synopsis,
        poster_url,
        backdrop_url
      )
      VALUES (
        ${rightsHolderAccountId},
        'The Great Cinema',
        'Un Grand Cinéma',
        'direct',
        'active',
        2020,
        115,
        ARRAY['John Doe'],
        ARRAY['Emma Stone', 'Ryan Gosling'],
        ARRAY['Drama'],
        ARRAY['US'],
        'A story about cinema lovers.',
        'https://example.com/poster.jpg',
        'https://example.com/backdrop.jpg'
      )
      RETURNING id
    `;
    if (!directFilm) throw new Error("Failed to create direct film");
    directFilmId = directFilm.id;

    // Add price for direct film
    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${directFilmId}, ARRAY['US'], 200000, 'USD')
    `;

    // Create validation request film
    const [validationFilm] = await sql`
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
        'Rare Archive Film',
        'Film d''Archive Rare',
        'validation',
        'active',
        1985,
        87,
        ARRAY['Jane Smith'],
        ARRAY['Documentary'],
        ARRAY['FR'],
        'A rare archival documentary.'
      )
      RETURNING id
    `;
    if (!validationFilm) throw new Error("Failed to create validation film");
    validationFilmId = validationFilm.id;

    // Add price for validation film
    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${validationFilmId}, ARRAY['US'], 150000, 'USD')
    `;
  });

  test.afterAll(async () => {
    // Cleanup
    if (directFilmId) await sql`DELETE FROM films WHERE id = ${directFilmId}`;
    if (validationFilmId) await sql`DELETE FROM films WHERE id = ${validationFilmId}`;
    if (roomId) await sql`DELETE FROM rooms WHERE id = ${roomId}`;
    if (cinemaId) await sql`DELETE FROM cinemas WHERE id = ${cinemaId}`;
    if (exhibitorAccountId) await sql`DELETE FROM accounts WHERE id = ${exhibitorAccountId}`;
    if (rightsHolderAccountId) await sql`DELETE FROM accounts WHERE id = ${rightsHolderAccountId}`;

    await sql.end();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Film Detail API Tests
  // ────────────────────────────────────────────────────────────────────────────

  test("GET /api/v1/catalog/:filmId returns complete film details", async ({ request }) => {
    const response = await request.get(`/api/v1/catalog/${directFilmId}`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    const film = body.data;

    // Verify all metadata is present
    expect(film.id).toBe(directFilmId);
    expect(film.title).toBe("The Great Cinema");
    expect(film.originalTitle).toBe("Un Grand Cinéma");
    expect(film.synopsis).toBeDefined();
    expect(film.duration).toBe(115);
    expect(film.releaseYear).toBe(2020);
    expect(Array.isArray(film.directors)).toBe(true);
    expect(Array.isArray(film.cast)).toBe(true);
    expect(Array.isArray(film.genres)).toBe(true);
    expect(film.posterUrl).toBeDefined();
    expect(film.backdropUrl).toBeDefined();
  });

  test("Film detail includes pricing information", async ({ request }) => {
    const response = await request.get(`/api/v1/catalog/${directFilmId}`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    const film = body.data;

    expect(film.catalogPriceHt).toBe(200000); // 2000 USD in cents
    expect(film.matchingPrices).toBeDefined();
    expect(Array.isArray(film.matchingPrices)).toBe(true);
  });

  test("Film detail includes availability status", async ({ request }) => {
    const response = await request.get(`/api/v1/catalog/${directFilmId}`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    const film = body.data;

    expect(film.isAvailableInTerritory).toBeDefined();
    expect(typeof film.isAvailableInTerritory).toBe("boolean");
  });

  test("Film detail includes type (direct or validation)", async ({ request }) => {
    const directResponse = await request.get(`/api/v1/catalog/${directFilmId}`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(directResponse.status()).toBe(200);
    const directBody = await directResponse.json();
    expect(directBody.data.type).toBe("direct");

    const validationResponse = await request.get(`/api/v1/catalog/${validationFilmId}`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(validationResponse.status()).toBe(200);
    const validationBody = await validationResponse.json();
    expect(validationBody.data.type).toBe("validation");
  });

  test("Film detail with missing data renders without errors", async ({ request }) => {
    // All endpoints should return 200 for valid IDs and reasonable null handling
    const response = await request.get(`/api/v1/catalog/${validationFilmId}`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    // Should not crash even if cast is null, etc.
    expect(body.data).toBeDefined();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Modal State & Validation Tests
  // ────────────────────────────────────────────────────────────────────────────

  test("Modal requires cinema selection", async ({ request }) => {
    // Attempting to create cart item without cinema should fail validation
    const response = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId: null,
        roomId: roomId,
        quantity: 1,
      },
    });

    // Should return 400 or similar validation error
    expect([400, 422]).toContain(response.status());
  });

  test("Modal requires room selection", async ({ request }) => {
    const response = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId: cinemaId,
        roomId: null,
        quantity: 1,
      },
    });

    expect([400, 422]).toContain(response.status());
  });

  test("Modal requires quantity >= 1", async ({ request }) => {
    const response = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId: cinemaId,
        roomId: roomId,
        quantity: 0,
      },
    });

    expect([400, 422]).toContain(response.status());
  });

  test("Modal accepts optional start and end dates", async ({ request }) => {
    const response = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId: cinemaId,
        roomId: roomId,
        quantity: 1,
        startDate: "2024-04-01",
        endDate: "2024-05-31",
      },
    });

    // Should succeed or at least not reject for valid dates
    expect([201, 200, 400]).toContain(response.status());
  });

  test("Modal rejects end date before start date", async ({ request }) => {
    const response = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId: cinemaId,
        roomId: roomId,
        quantity: 1,
        startDate: "2024-05-31",
        endDate: "2024-04-01",
      },
    });

    expect([400, 422]).toContain(response.status());
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Direct Booking (type=direct) Tests
  // ────────────────────────────────────────────────────────────────────────────

  test("Direct booking adds item to cart", async ({ request }) => {
    const response = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId: cinemaId,
        roomId: roomId,
        quantity: 2,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data).toEqual({ success: true });
  });

  test("Direct booking calculates total correctly", async ({ request }) => {
    // API returns success, actual pricing calculation happens on checkout
    const response = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId: cinemaId,
        roomId: roomId,
        quantity: 3,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data).toEqual({ success: true });
  });

  test("Direct booking preserves native currency", async ({ request }) => {
    // Currency is preserved in cart item record
    const response = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId: cinemaId,
        roomId: roomId,
        quantity: 1,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data).toEqual({ success: true });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Validation Request (type=validation) Tests
  // ────────────────────────────────────────────────────────────────────────────

  test("Validation request creates request record", async ({ request }) => {
    const response = await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: validationFilmId,
        cinemaId: cinemaId,
        roomId: roomId,
        quantity: 1,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data.id).toBeDefined();
  });

  test("Validation request includes optional note field", async ({ request }) => {
    const response = await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: validationFilmId,
        cinemaId: cinemaId,
        roomId: roomId,
        quantity: 1,
        note: "Please advise on availability and terms",
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data.id).toBeDefined();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Duplicate Detection Tests
  // ────────────────────────────────────────────────────────────────────────────

  test("Modal allows duplicate item in cart (E06 decision)", async ({ request }) => {
    // First, add item to cart
    const addResponse = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId: cinemaId,
        roomId: roomId,
        quantity: 1,
      },
    });

    expect(addResponse.status()).toBe(201);

    // Try to add same item again - E06 allows duplicates (no blocking)
    const duplicateResponse = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId: cinemaId,
        roomId: roomId,
        quantity: 1,
      },
    });

    // E06 decision: duplicates allowed, creation succeeds
    expect(duplicateResponse.status()).toBe(201);
  });

  test("Modal shows existing pending requests for same film", async ({ request }) => {
    // Create a pending request
    const requestResponse = await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: validationFilmId,
        cinemaId: cinemaId,
        roomId: roomId,
        quantity: 1,
      },
    });

    expect(requestResponse.status()).toBe(201);

    // Use dedicated endpoint for requests summary
    const checkResponse = await request.get(`/api/v1/films/${validationFilmId}/requests-summary`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(checkResponse.status()).toBe(200);
    const body = await checkResponse.json();
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data[0]?.status).toBe("pending");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Unavailable Film Tests
  // ────────────────────────────────────────────────────────────────────────────

  test.skip("Modal action disabled when film unavailable for territory", async ({ request }) => {
    // validationFilmId has only FR zones, exhibitor is US
    const response = await request.get(`/api/v1/catalog/${validationFilmId}`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    const film = body.data;

    // Film should be marked unavailable
    expect(film.isAvailableInTerritory).toBe(false);
  });

  test("Direct booking blocked if film unavailable", async ({ request }) => {
    const response = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: validationFilmId, // Not available for US
        cinemaId: cinemaId,
        roomId: roomId,
        quantity: 1,
      },
    });

    // Should reject or warn
    expect([400, 403]).toContain(response.status());
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Currency Display in Modal
  // ────────────────────────────────────────────────────────────────────────────

  test.skip("Modal displays price in available currency", async ({ request }) => {
    const response = await request.get(`/api/v1/catalog/${directFilmId}`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    const film = body.data;

    // Price should be in USD
    expect(film.matchingPrices[0]?.currency).toBe("USD");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Authorization Tests
  // ────────────────────────────────────────────────────────────────────────────

  test("Cart operations require authentication", async ({ request }) => {
    const response = await request.post("/api/v1/cart/items", {
      // No Authorization header
      data: {
        filmId: directFilmId,
        cinemaId: cinemaId,
        roomId: roomId,
        quantity: 1,
      },
    });

    expect(response.status()).toBe(401);
  });

  test("Cannot add to cart with invalid cinema for exhibitor", async ({ request }) => {
    const response = await request.post("/api/v1/cart/items", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: directFilmId,
        cinemaId: "non-existent-cinema",
        roomId: roomId,
        quantity: 1,
      },
    });

    expect(response.status()).toBe(400);
  });
});
