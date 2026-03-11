/**
 * E2E tests for Validation Requests (E06 + E07).
 * Tests: create requests, cancel, relaunch, status transitions,
 * incoming requests, approve, reject workflows.
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

// ─── E07: Rights Holder endpoints (incoming, approve, reject) ─────────────

test.describe("E07 — Rights Holder request workflow", () => {
  let sql: ReturnType<typeof postgres>;
  let rhToken: string;
  let rhAccountId: string;
  let exhibitorAccountId: string;
  let catalogFilmId: string;
  let cinemaId: string;
  let roomId: string;
  let exhibitorToken: string;

  test.beforeAll(async () => {
    sql = postgres(DATABASE_URL, { max: 1 });

    // Create rights holder account
    const [rh] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('rights_holder', 'E07 RH Tests', 'FR', true)
      RETURNING id
    `;
    rhAccountId = rh!.id;

    // RH user
    const rhSuffix = randomBytes(6).toString("hex");
    const [rhUser] = await sql`
      INSERT INTO better_auth_users (id, email, email_verified, name, created_at, updated_at)
      VALUES (gen_random_uuid(), ${"rh-e07-" + rhSuffix + "@test.local"}, true, 'RH E07', NOW(), NOW())
      RETURNING id
    `;
    await sql`INSERT INTO account_members (account_id, user_id, role) VALUES (${rhAccountId}, ${rhUser!.id}, 'owner')`;

    // RH API token
    const rawRhToken = `tmls_${randomBytes(20).toString("hex")}`;
    const rhHash = createHash("sha256").update(rawRhToken).digest("hex");
    await sql`
      INSERT INTO api_tokens (account_id, token_hash, name, token_prefix)
      VALUES (${rhAccountId}, ${rhHash}, 'rh-e07-token', ${rawRhToken.substring(0, 13)})
    `;
    rhToken = rawRhToken;

    // Create exhibitor account
    const [exhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('exhibitor', 'E07 Exhibitor Tests', 'FR', true)
      RETURNING id
    `;
    exhibitorAccountId = exhibitor!.id;

    // Exhibitor user
    const exSuffix = randomBytes(6).toString("hex");
    const [exUser] = await sql`
      INSERT INTO better_auth_users (id, email, email_verified, name, created_at, updated_at)
      VALUES (gen_random_uuid(), ${"ex-e07-" + exSuffix + "@test.local"}, true, 'EX E07', NOW(), NOW())
      RETURNING id
    `;
    await sql`INSERT INTO account_members (account_id, user_id, role) VALUES (${exhibitorAccountId}, ${exUser!.id}, 'owner')`;

    // Exhibitor API token
    const rawExToken = `tmls_${randomBytes(20).toString("hex")}`;
    const exHash = createHash("sha256").update(rawExToken).digest("hex");
    await sql`
      INSERT INTO api_tokens (account_id, token_hash, name, token_prefix)
      VALUES (${exhibitorAccountId}, ${exHash}, 'ex-e07-token', ${rawExToken.substring(0, 13)})
    `;
    exhibitorToken = rawExToken;

    // Create catalog film (requires validation)
    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rhAccountId}, 'E07 Test Film', 'validation', 'active', 1995)
      RETURNING id
    `;
    catalogFilmId = film!.id;

    // Film price for France
    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${catalogFilmId}, ARRAY['FR'], 20000, 'EUR')
    `;

    // Cinema + room for exhibitor
    const [cinema] = await sql`
      INSERT INTO cinemas (account_id, name, address, city, postal_code, country)
      VALUES (${exhibitorAccountId}, 'E07 Cinema', '10 Rue E07', 'Paris', '75001', 'FR')
      RETURNING id
    `;
    cinemaId = cinema!.id;

    const [room] = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinemaId}, 'Salle E07', 200)
      RETURNING id
    `;
    roomId = room!.id;
  });

  test.afterAll(async () => {
    await sql.end();
  });

  /** Helper: create a pending request and return its id */
  async function createPendingRequest(
    request: import("@playwright/test").APIRequestContext,
    opts?: { note?: string }
  ): Promise<string> {
    const res = await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: {
        filmId: catalogFilmId,
        cinemaId,
        roomId,
        quantity: 2,
        note: opts?.note,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    return body.data.id;
  }

  // ── GET /api/v1/requests/incoming ───────────────────────────────────────

  test("GET /incoming returns pending requests by default", async ({ request }) => {
    // Create a pending request
    await createPendingRequest(request);

    const res = await request.get("/api/v1/requests/incoming", {
      headers: { Authorization: `Bearer ${rhToken}` },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    for (const r of body.data) {
      expect(r.status).toBe("pending");
    }
  });

  test("GET /incoming?status=approved returns only approved", async ({ request }) => {
    // Create and approve a request
    const requestId = await createPendingRequest(request);
    await sql`UPDATE requests SET status = 'approved', approved_at = NOW() WHERE id = ${requestId}`;

    const res = await request.get("/api/v1/requests/incoming?status=approved", {
      headers: { Authorization: `Bearer ${rhToken}` },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const r of body.data) {
      expect(r.status).toBe("approved");
    }
  });

  test("GET /incoming supports pagination", async ({ request }) => {
    const res = await request.get("/api/v1/requests/incoming?page=1&limit=2", {
      headers: { Authorization: `Bearer ${rhToken}` },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(2);
    expect(typeof body.pagination.total).toBe("number");
    expect(body.data.length).toBeLessThanOrEqual(2);
  });

  test("GET /incoming requires auth", async ({ request }) => {
    const res = await request.get("/api/v1/requests/incoming");
    expect(res.status()).toBe(401);
  });

  // ── POST /api/v1/requests/:id/approve ───────────────────────────────────

  test("POST /approve transitions to approved", async ({ request }) => {
    const requestId = await createPendingRequest(request);

    const res = await request.post(`/api/v1/requests/${requestId}/approve`, {
      headers: { Authorization: `Bearer ${rhToken}` },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.status).toBe("approved");

    // Verify in DB
    const [row] = await sql`SELECT status, approved_at FROM requests WHERE id = ${requestId}`;
    expect(row!.status).toBe("approved");
    expect(row!.approved_at).not.toBeNull();
  });

  test("POST /approve with note stores approval note", async ({ request }) => {
    const requestId = await createPendingRequest(request);

    const res = await request.post(`/api/v1/requests/${requestId}/approve`, {
      headers: { Authorization: `Bearer ${rhToken}` },
      data: { note: "Approved with pleasure" },
    });
    expect(res.status()).toBe(200);

    const [row] = await sql`SELECT approval_note FROM requests WHERE id = ${requestId}`;
    expect(row!.approval_note).toBe("Approved with pleasure");
  });

  test("POST /approve on already-processed request returns 409", async ({ request }) => {
    const requestId = await createPendingRequest(request);
    // Approve first
    await request.post(`/api/v1/requests/${requestId}/approve`, {
      headers: { Authorization: `Bearer ${rhToken}` },
    });

    // Try to approve again
    const res = await request.post(`/api/v1/requests/${requestId}/approve`, {
      headers: { Authorization: `Bearer ${rhToken}` },
    });
    expect(res.status()).toBe(409);

    const body = await res.json();
    expect(body.error.code).toBe("INVALID_TRANSITION");
  });

  test("POST /approve with wrong RH account returns 403", async ({ request }) => {
    const requestId = await createPendingRequest(request);

    // Create another RH account with its own token
    const [otherRh] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('rights_holder', 'Other RH E07', 'FR', true)
      RETURNING id
    `;
    const otherRawToken = `tmls_${randomBytes(20).toString("hex")}`;
    const otherHash = createHash("sha256").update(otherRawToken).digest("hex");
    await sql`
      INSERT INTO api_tokens (account_id, token_hash, name, token_prefix)
      VALUES (${otherRh!.id}, ${otherHash}, 'other-rh-e07', ${otherRawToken.substring(0, 13)})
    `;

    const res = await request.post(`/api/v1/requests/${requestId}/approve`, {
      headers: { Authorization: `Bearer ${otherRawToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test("POST /approve requires auth", async ({ request }) => {
    const requestId = await createPendingRequest(request);
    const res = await request.post(`/api/v1/requests/${requestId}/approve`);
    expect(res.status()).toBe(401);
  });

  // ── POST /api/v1/requests/:id/reject ────────────────────────────────────

  test("POST /reject transitions to rejected", async ({ request }) => {
    const requestId = await createPendingRequest(request);

    const res = await request.post(`/api/v1/requests/${requestId}/reject`, {
      headers: { Authorization: `Bearer ${rhToken}` },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.status).toBe("rejected");

    const [row] = await sql`SELECT status, rejected_at FROM requests WHERE id = ${requestId}`;
    expect(row!.status).toBe("rejected");
    expect(row!.rejected_at).not.toBeNull();
  });

  test("POST /reject with reason stores rejection reason", async ({ request }) => {
    const requestId = await createPendingRequest(request);

    const res = await request.post(`/api/v1/requests/${requestId}/reject`, {
      headers: { Authorization: `Bearer ${rhToken}` },
      data: { reason: "Not available for this territory" },
    });
    expect(res.status()).toBe(200);

    const [row] = await sql`SELECT rejection_reason FROM requests WHERE id = ${requestId}`;
    expect(row!.rejection_reason).toBe("Not available for this territory");
  });

  test("POST /reject on already-processed returns 409", async ({ request }) => {
    const requestId = await createPendingRequest(request);
    await request.post(`/api/v1/requests/${requestId}/reject`, {
      headers: { Authorization: `Bearer ${rhToken}` },
    });

    const res = await request.post(`/api/v1/requests/${requestId}/reject`, {
      headers: { Authorization: `Bearer ${rhToken}` },
    });
    expect(res.status()).toBe(409);

    const body = await res.json();
    expect(body.error.code).toBe("INVALID_TRANSITION");
  });

  test("POST /reject requires auth", async ({ request }) => {
    const requestId = await createPendingRequest(request);
    const res = await request.post(`/api/v1/requests/${requestId}/reject`);
    expect(res.status()).toBe(401);
  });
});

// ─── E07: Exhibitor endpoints (list, filter, cancel, relaunch) ────────────

test.describe("E07 — Exhibitor request workflow", () => {
  let sql: ReturnType<typeof postgres>;
  let exhibitorToken: string;
  let exhibitorAccountId: string;
  let rhAccountId: string;
  let catalogFilmId: string;
  let cinemaId: string;
  let roomId: string;

  test.beforeAll(async () => {
    sql = postgres(DATABASE_URL, { max: 1 });

    // RH account
    const [rh] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('rights_holder', 'E07 ExFlow RH', 'FR', true)
      RETURNING id
    `;
    rhAccountId = rh!.id;

    // Exhibitor account
    const [exhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('exhibitor', 'E07 ExFlow Exhibitor', 'FR', true)
      RETURNING id
    `;
    exhibitorAccountId = exhibitor!.id;

    // Exhibitor user
    const exSuffix = randomBytes(6).toString("hex");
    const [exUser] = await sql`
      INSERT INTO better_auth_users (id, email, email_verified, name, created_at, updated_at)
      VALUES (gen_random_uuid(), ${"exflow-e07-" + exSuffix + "@test.local"}, true, 'ExFlow E07', NOW(), NOW())
      RETURNING id
    `;
    await sql`INSERT INTO account_members (account_id, user_id, role) VALUES (${exhibitorAccountId}, ${exUser!.id}, 'owner')`;

    // Exhibitor API token
    const rawToken = `tmls_${randomBytes(20).toString("hex")}`;
    const hash = createHash("sha256").update(rawToken).digest("hex");
    await sql`
      INSERT INTO api_tokens (account_id, token_hash, name, token_prefix)
      VALUES (${exhibitorAccountId}, ${hash}, 'exflow-e07-token', ${rawToken.substring(0, 13)})
    `;
    exhibitorToken = rawToken;

    // Film
    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rhAccountId}, 'E07 ExFlow Film', 'validation', 'active', 1990)
      RETURNING id
    `;
    catalogFilmId = film!.id;

    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${catalogFilmId}, ARRAY['FR'], 15000, 'EUR')
    `;

    // Cinema + room
    const [cinema] = await sql`
      INSERT INTO cinemas (account_id, name, address, city, postal_code, country)
      VALUES (${exhibitorAccountId}, 'ExFlow Cinema', '20 Rue ExFlow', 'Lyon', '69001', 'FR')
      RETURNING id
    `;
    cinemaId = cinema!.id;

    const [room] = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinemaId}, 'Salle ExFlow', 150)
      RETURNING id
    `;
    roomId = room!.id;
  });

  test.afterAll(async () => {
    await sql.end();
  });

  /** Helper: create a pending request and return its id */
  async function createPendingRequest(
    request: import("@playwright/test").APIRequestContext
  ): Promise<string> {
    const res = await request.post("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
      data: { filmId: catalogFilmId, cinemaId, roomId, quantity: 1 },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).data.id;
  }

  // ── GET /api/v1/requests ────────────────────────────────────────────────

  test("GET /requests lists exhibitor requests", async ({ request }) => {
    await createPendingRequest(request);

    const res = await request.get("/api/v1/requests", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.pagination).toBeDefined();
  });

  test("GET /requests filters by status", async ({ request }) => {
    const id = await createPendingRequest(request);
    await sql`UPDATE requests SET status = 'rejected', rejected_at = NOW() WHERE id = ${id}`;

    const res = await request.get("/api/v1/requests?status=rejected", {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const r of body.data) {
      expect(r.status).toBe("rejected");
    }
  });

  test("GET /requests requires auth", async ({ request }) => {
    const res = await request.get("/api/v1/requests");
    expect(res.status()).toBe(401);
  });

  // ── POST /api/v1/requests/:id/cancel ────────────────────────────────────

  test("POST /cancel transitions pending to cancelled", async ({ request }) => {
    const id = await createPendingRequest(request);

    const res = await request.post(`/api/v1/requests/${id}/cancel`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.status).toBe("cancelled");

    const [row] = await sql`SELECT status, cancelled_at FROM requests WHERE id = ${id}`;
    expect(row!.status).toBe("cancelled");
    expect(row!.cancelled_at).not.toBeNull();
  });

  test("POST /cancel on non-pending request returns 409", async ({ request }) => {
    const id = await createPendingRequest(request);
    // Approve it first
    await sql`UPDATE requests SET status = 'approved', approved_at = NOW() WHERE id = ${id}`;

    const res = await request.post(`/api/v1/requests/${id}/cancel`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });
    expect(res.status()).toBe(409);
  });

  // ── POST /api/v1/requests/:id/relaunch ──────────────────────────────────

  test("POST /relaunch creates new pending from cancelled request", async ({ request }) => {
    const id = await createPendingRequest(request);
    // Cancel it
    await request.post(`/api/v1/requests/${id}/cancel`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });

    const res = await request.post(`/api/v1/requests/${id}/relaunch`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });
    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.data.status).toBe("pending");
    expect(body.data.id).not.toBe(id); // New request, different ID
  });

  test("POST /relaunch on pending request returns 409", async ({ request }) => {
    const id = await createPendingRequest(request);

    const res = await request.post(`/api/v1/requests/${id}/relaunch`, {
      headers: { Authorization: `Bearer ${exhibitorToken}` },
    });
    expect(res.status()).toBe(409);
  });
});
