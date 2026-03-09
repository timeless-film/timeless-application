/**
 * E2E tests for Validation Requests (E06).
 * Tests: create requests, cancel, relaunch, status transitions.
 */
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { createHash, randomBytes } from "node:crypto";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://timeless:timeless@localhost:5432/timeless_test";

test.describe("Validation Requests", () => {
  let sql: ReturnType<typeof postgres>;
  let exhibitorToken: string;
  let exhibitorAccountId: string;
  let rightsHolderAccountId: string;
  let catalogFilmId: string;
  let cinemaId: string;
  let roomId: string;

  test.beforeAll(async () => {
    sql = postgres(DATABASE_URL, { max: 1 });

    // Create rights holder account
    const [rightsHolder] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('rights_holder', 'Test RH Requests', 'FR', true)
      RETURNING id
    `;
    rightsHolderAccountId = rightsHolder!.id;

    // Create exhibitor account
    const [exhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('exhibitor', 'Test Cinema Requests', 'FR', true)
      RETURNING id
    `;
    exhibitorAccountId = exhibitor!.id;

    // Create exhibitor user
    const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    const [user] = await sql`
      INSERT INTO better_auth_users (id, email, email_verified, name, created_at, updated_at)
      VALUES (gen_random_uuid(), ${'exhibitor-requests-' + uniqueSuffix + '@test.com'}, true, 'Request Tester', NOW(), NOW())
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

    // Create catalog film (requires validation)
    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rightsHolderAccountId}, 'Catalog Test Film', 'validation', 'active', 2010)
      RETURNING id
    `;
    catalogFilmId = film!.id;

    // Create film price for France
    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${catalogFilmId}, ARRAY['FR'], 15000, 'EUR')
    `;

    // Create cinema
    const [cinema] = await sql`
      INSERT INTO cinemas (account_id, name, address, city, postal_code, country)
      VALUES (${exhibitorAccountId}, 'Test Cinema FR', '1 Rue Test', 'Paris', '75001', 'FR')
      RETURNING id
    `;
    cinemaId = cinema!.id;

    // Create room
    const [room] = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinemaId}, 'Salle 1', 120)
      RETURNING id
    `;
    roomId = room!.id;
  });

  test.afterAll(async () => {
    await sql.end();
  });

  test.beforeEach(async () => {
    // Clear requests before each test
    await sql`DELETE FROM requests WHERE exhibitor_account_id = ${exhibitorAccountId}`;
  });

  test("Create validation request successfully", async ({ request }) => {
    const response = await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: catalogFilmId,
        cinemaId,
        roomId,
        quantity: 3,
        note: "Test request for E2E",
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.data.id).toBeDefined();

    // Verify request in DB
    const requests = await sql`
      SELECT * FROM requests
      WHERE id = ${body.data.id}
    `;
    expect(requests.length).toBe(1);
    expect(requests[0]!.status).toBe("pending");
    expect(requests[0]!.note).toBe("Test request for E2E");
    expect(requests[0]!.screening_count).toBe(3);
  });

  test("Create request with dates", async ({ request }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    const startDate = tomorrow.toISOString().split("T")[0];

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 9);
    const endDate = nextWeek.toISOString().split("T")[0];

    const response = await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: catalogFilmId,
        cinemaId,
        roomId,
        quantity: 1,
        startDate,
        endDate,
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();

    // Verify dates in DB
    const requests = await sql`
      SELECT * FROM requests WHERE id = ${body.data.id}
    `;
    expect(requests[0]!.start_date).toBeDefined();
    expect(requests[0]!.end_date).toBeDefined();
  });

  test("Get requests summary for film", async ({ request }) => {
    // Create a pending request
    const response1 = await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: catalogFilmId,
        cinemaId,
        roomId,
        quantity: 1,
      },
    });
    const { id: requestId1 } = (await response1.json()).data;

    // Create another pending request
    await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: catalogFilmId,
        cinemaId,
        roomId,
        quantity: 2,
      },
    });

    // Approve first request manually
    await sql`
      UPDATE requests
      SET status = 'approved'
      WHERE id = ${requestId1}
    `;

    // Get summary
    const response = await request.get(
      `/api/v1/films/${catalogFilmId}/requests-summary`,
      {
        headers: { Authorization: `Bearer ${exhibitorToken}` },
      }
    );

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.length).toBe(2); // Both pending and approved
    expect(body.data.some((r: any) => r.status === "pending")).toBe(true);
    expect(body.data.some((r: any) => r.status === "approved")).toBe(true);
  });

  test("Requests summary excludes rejected/cancelled", async ({ request }) => {
    // Create and reject a request
    const response1 = await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: catalogFilmId,
        cinemaId,
        roomId,
        quantity: 1,
      },
    });
    const { id: rejectedId } = (await response1.json()).data;
    await sql`UPDATE requests SET status = 'rejected' WHERE id = ${rejectedId}`;

    // Create and cancel a request
    const response2 = await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: catalogFilmId,
        cinemaId,
        roomId,
        quantity: 1,
      },
    });
    const { id: cancelledId } = (await response2.json()).data;
    await sql`UPDATE requests SET status = 'cancelled' WHERE id = ${cancelledId}`;

    // Create pending request
    await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: catalogFilmId,
        cinemaId,
        roomId,
        quantity: 1,
      },
    });

    // Get summary - should only see pending
    const response = await request.get(
      `/api/v1/films/${catalogFilmId}/requests-summary`,
      {
        headers: { Authorization: `Bearer ${exhibitorToken}` },
      }
    );

    const body = await response.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0]!.status).toBe("pending");
  });

  test("Cannot create request without room", async ({ request }) => {
    const response = await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: catalogFilmId,
        cinemaId,
        // Missing roomId
        quantity: 1,
      },
    });

    expect(response.status()).toBe(400);
  });

  test("Cannot create request with invalid cinema ownership", async ({
    request,
  }) => {
    // Create another exhibitor's cinema
    const [otherExhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('exhibitor', 'Other Cinema', 'FR', true)
      RETURNING id
    `;

    const [otherCinema] = await sql`
      INSERT INTO cinemas (account_id, name, address, city, postal_code, country)
      VALUES (${otherExhibitor!.id}, 'Other Cinema', '2 Rue Test', 'Lyon', '69001', 'FR')
      RETURNING id
    `;

    const [otherRoom] = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${otherCinema!.id}, 'Other Room', 50)
      RETURNING id
    `;

    const response = await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: catalogFilmId,
        cinemaId: otherCinema!.id,
        roomId: otherRoom!.id,
        quantity: 1,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("INVALID_CINEMA");
  });

  test("Requests require authentication", async ({ request }) => {
    const response = await request.post("/api/v1/requests", {
      // No Authorization header
      data: {
        filmId: catalogFilmId,
        cinemaId,
        roomId,
        quantity: 1,
      },
    });

    expect(response.status()).toBe(401);
  });

  test("Request captures pricing snapshot", async ({ request }) => {
    const response = await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: catalogFilmId,
        cinemaId,
        roomId,
        quantity: 2,
      },
    });

    const { id } = (await response.json()).data;

    // Verify pricing data stored
    const requests = await sql`
      SELECT * FROM requests WHERE id = ${id}
    `;
    expect(requests[0]!.catalog_price).toBeDefined();
    expect(requests[0]!.platform_margin_rate).toBeDefined();
    expect(requests[0]!.commission_rate).toBeDefined();
    expect(requests[0]!.delivery_fees).toBeDefined();
    expect(requests[0]!.displayed_price).toBeDefined();
    expect(requests[0]!.currency).toBe("EUR");
  });

  test("Allows duplicate requests in E06", async ({ request }) => {
    // Create first request
    const response1 = await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: catalogFilmId,
        cinemaId,
        roomId,
        quantity: 1,
      },
    });
    expect(response1.status()).toBe(201);

    // Create duplicate - should succeed in E06
    const response2 = await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: catalogFilmId,
        cinemaId,
        roomId,
        quantity: 1,
      },
    });
    expect(response2.status()).toBe(201);

    // Verify both exist
    const requests = await sql`
      SELECT * FROM requests
      WHERE exhibitor_account_id = ${exhibitorAccountId}
      AND film_id = ${catalogFilmId}
    `;
    expect(requests.length).toBe(2);
  });
});
