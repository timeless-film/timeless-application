import { expect, test } from "@playwright/test";
import postgres from "postgres";

import type { APIRequestContext } from "@playwright/test";

const TEST_ID = Date.now().toString(36);

const DB_URL =
  process.env.DATABASE_URL ?? "postgresql://timeless:timeless@localhost:5432/timeless";

// ---------------------------------------------------------------------------
// Setup: create a user with a completed onboarding + API token, all via DB
// ---------------------------------------------------------------------------

let bearerToken = "";
let cinemaId = "";

test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
  const email = `apiv1-${TEST_ID}@e2e-test.local`;
  const password = "StrongPass123!";

  // 1. Register user via API
  const signupRes = await request.post("/api/auth/sign-up/email", {
    data: { name: "API V1 User", email, password },
    headers: { "Content-Type": "application/json" },
  });
  expect(signupRes.ok()).toBeTruthy();

  const sql = postgres(DB_URL, { max: 1 });

  // 2. Verify email
  await sql`UPDATE better_auth_users SET email_verified = true WHERE email = ${email}`;

  // 3. Get user ID
  const users = await sql`SELECT id FROM better_auth_users WHERE email = ${email}`;
  const userId = users[0]!.id as string;

  // 4. Create account with onboarding completed
  const accounts = await sql`
    INSERT INTO accounts (type, company_name, country, onboarding_completed)
    VALUES ('exhibitor', ${"API V1 Co " + TEST_ID}, 'FR', true)
    RETURNING id
  `;
  const accountId = accounts[0]!.id as string;

  // 5. Add user as owner
  await sql`
    INSERT INTO account_members (account_id, user_id, role)
    VALUES (${accountId}, ${userId}, 'owner')
  `;

  // 6. Create a cinema with a default room
  const cinemas = await sql`
    INSERT INTO cinemas (name, country, city, account_id)
    VALUES (${"API Cinema " + TEST_ID}, 'FR', 'Paris', ${accountId})
    RETURNING id
  `;
  cinemaId = cinemas[0]!.id as string;

  await sql`
    INSERT INTO rooms (name, capacity, cinema_id)
    VALUES ('Salle 1', 100, ${cinemaId})
  `;

  // 7. Create an API token
  const { createHash, randomBytes } = await import("node:crypto");
  const rawToken = "tmls_" + randomBytes(20).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const tokenPrefix = rawToken.substring(0, 13);

  await sql`
    INSERT INTO api_tokens (account_id, name, token_hash, token_prefix)
    VALUES (${accountId}, 'E2E Token', ${tokenHash}, ${tokenPrefix})
  `;

  bearerToken = rawToken;

  await sql.end();
});

// ---------------------------------------------------------------------------
// API v1 tests
// ---------------------------------------------------------------------------
test.describe("API v1 — Cinemas", () => {
  test("GET /api/v1/cinemas returns cinema list", async ({ request }) => {
    const response = await request.get("/api/v1/cinemas", {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBeTruthy();
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const cinema = body.data[0];
    expect(cinema.name).toContain("API Cinema");
    expect(cinema.rooms).toBeDefined();
    expect(Array.isArray(cinema.rooms)).toBeTruthy();
  });

  test("POST /api/v1/cinemas creates a cinema", async ({ request }) => {
    const response = await request.post("/api/v1/cinemas", {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
      data: {
        name: `POST Cinema ${TEST_ID}`,
        country: "GB",
        city: "London",
        address: "10 Leicester Square",
      },
    });
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.data.name).toBe(`POST Cinema ${TEST_ID}`);
    expect(body.data.country).toBe("GB");
    expect(body.data.city).toBe("London");
  });

  test("PATCH /api/v1/cinemas/:id updates a cinema", async ({ request }) => {
    const response = await request.patch(`/api/v1/cinemas/${cinemaId}`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
      data: {
        name: `Patched Cinema ${TEST_ID}`,
      },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.name).toBe(`Patched Cinema ${TEST_ID}`);
  });

  test("GET /api/v1/cinemas/:id returns cinema detail", async ({ request }) => {
    const response = await request.get(`/api/v1/cinemas/${cinemaId}`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data.id).toBe(cinemaId);
  });

  test("GET /api/v1/cinemas without Bearer returns 401", async ({ request }) => {
    const response = await request.get("/api/v1/cinemas");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});

test.describe("API v1 — Rooms", () => {
  test("GET /api/v1/cinemas/:id/rooms returns room list", async ({ request }) => {
    const response = await request.get(`/api/v1/cinemas/${cinemaId}/rooms`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBeTruthy();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
  });

  test("POST /api/v1/cinemas/:id/rooms creates a room", async ({ request }) => {
    const response = await request.post(`/api/v1/cinemas/${cinemaId}/rooms`, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
      data: {
        name: `API Room ${TEST_ID}`,
        capacity: 200,
        reference: "API-R1",
      },
    });
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body.data.name).toBe(`API Room ${TEST_ID}`);
    expect(body.data.capacity).toBe(200);
    expect(body.data.reference).toBe("API-R1");

    // Test PATCH and DELETE on this room
    const roomId = body.data.id;

    // PATCH
    const patchRes = await request.patch(
      `/api/v1/cinemas/${cinemaId}/rooms/${roomId}`,
      {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          "Content-Type": "application/json",
        },
        data: { capacity: 300 },
      },
    );
    expect(patchRes.status()).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.data.capacity).toBe(300);

    // DELETE (archive)
    const deleteRes = await request.delete(
      `/api/v1/cinemas/${cinemaId}/rooms/${roomId}`,
      {
        headers: { Authorization: `Bearer ${bearerToken}` },
      },
    );
    expect(deleteRes.status()).toBe(200);
  });

  test("DELETE /api/v1/cinemas/:id returns 409 for last cinema", async ({
    request,
  }) => {
    // First, we need to archive all cinemas except one — but in practice,
    // the original cinema is the only non-archived one for this account.
    // Let's try to archive it and expect 409.
    const response = await request.delete(`/api/v1/cinemas/${cinemaId}`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });

    // If only one cinema remains, should be 409
    // (the POST test above created another cinema, so we might need to archive that first)
    // Let's check: first get cinemas to see which ones exist
    const listRes = await request.get("/api/v1/cinemas", {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    const listBody = await listRes.json();

    if (listBody.data.length > 1) {
      // Archive non-original cinemas first
      for (const c of listBody.data) {
        if (c.id !== cinemaId) {
          await request.delete(`/api/v1/cinemas/${c.id}`, {
            headers: { Authorization: `Bearer ${bearerToken}` },
          });
        }
      }
    }

    // Now try to archive the last cinema
    const lastDeleteRes = await request.delete(`/api/v1/cinemas/${cinemaId}`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    expect(lastDeleteRes.status()).toBe(409);

    const body = await lastDeleteRes.json();
    expect(body.error.code).toBe("LAST_CINEMA");
  });
});
