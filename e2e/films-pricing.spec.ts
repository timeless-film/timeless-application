import { expect, test } from "@playwright/test";

import { createRightsHolderContext } from "./helpers/rights-holder";

const TEST_ID = Date.now().toString(36);

let bearerToken = "";
let filmId = "";
let initialPriceId = "";

test.beforeAll(async ({ request }) => {
  const context = await createRightsHolderContext(request, TEST_ID, "films-pricing");
  bearerToken = context.bearerToken;

  const createRes = await request.post("/api/v1/films", {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    data: {
      title: `Pricing Film ${TEST_ID}`,
      externalId: `PRICE-${TEST_ID}`,
      type: "direct",
      status: "active",
      prices: [
        { countries: ["FR", "BE"], price: 15000, currency: "EUR" },
        { countries: ["US"], price: 22000, currency: "USD" },
      ],
    },
  });

  expect(createRes.status()).toBe(201);
  const createBody = await createRes.json();
  filmId = createBody.data.id as string;
  initialPriceId = createBody.data.prices[0].id as string;
});

test("supports multiple price zones", async ({ request }) => {
  const pricesRes = await request.get(`/api/v1/films/${filmId}/prices`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  expect(pricesRes.status()).toBe(200);
  const body = await pricesRes.json();
  expect(Array.isArray(body.data)).toBeTruthy();
  expect(body.data.length).toBeGreaterThanOrEqual(2);
});

test("rejects duplicate country across zones", async ({ request }) => {
  const duplicateRes = await request.post(`/api/v1/films/${filmId}/prices`, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    data: {
      countries: ["FR"],
      price: 30000,
      currency: "EUR",
    },
  });

  expect(duplicateRes.status()).toBe(409);
  const body = await duplicateRes.json();
  expect(body.error.code).toBe("DUPLICATE_COUNTRY");
});

test("stores prices in cents", async ({ request }) => {
  const patchRes = await request.patch(`/api/v1/films/${filmId}/prices/${initialPriceId}`, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    data: {
      price: 19999,
    },
  });

  expect(patchRes.status()).toBe(200);

  const pricesRes = await request.get(`/api/v1/films/${filmId}/prices`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  expect(pricesRes.status()).toBe(200);

  const pricesBody = await pricesRes.json();
  const target = pricesBody.data.find((zone: { id: string }) => zone.id === initialPriceId) as
    | { price: number }
    | undefined;

  expect(target).toBeDefined();
  expect(target?.price).toBe(19999);
});
