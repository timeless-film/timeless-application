import { expect, test } from "@playwright/test";

import { createRightsHolderContext, loginAsRightsHolder } from "./helpers/rights-holder";

const TEST_ID = Date.now().toString(36);

let bearerToken = "";
let filmId = "";

test.beforeAll(async ({ request }) => {
  const context = await createRightsHolderContext(request, TEST_ID, "films-crud");
  bearerToken = context.bearerToken;

  const createRes = await request.post("/api/v1/films", {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    data: {
      title: `CRUD Film ${TEST_ID}`,
      externalId: `CRUD-${TEST_ID}`,
      type: "direct",
      status: "active",
      prices: [{ countries: ["FR"], price: 15000, currency: "EUR" }],
    },
  });

  expect(createRes.status()).toBe(201);
  const body = await createRes.json();
  filmId = body.data.id as string;
});

test("rights holder can see film in /films list", async ({ page, request }) => {
  const context = await createRightsHolderContext(request, `${TEST_ID}-list`, "films-crud-list");

  const createRes = await request.post("/api/v1/films", {
    headers: {
      Authorization: `Bearer ${context.bearerToken}`,
      "Content-Type": "application/json",
    },
    data: {
      title: `Visible Film ${TEST_ID}`,
      externalId: `VIS-${TEST_ID}`,
      type: "direct",
      status: "active",
      prices: [{ countries: ["FR"], price: 12000, currency: "EUR" }],
    },
  });
  expect(createRes.status()).toBe(201);

  await loginAsRightsHolder(page, context);
  await page.getByRole("link", { name: /my films/i }).click();
  await expect(page).toHaveURL(/\/en\/films/, { timeout: 15000 });

  await expect(page.getByRole("link", { name: /add a film/i })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(`Visible Film ${TEST_ID}`)).toBeVisible({ timeout: 15000 });
});

test("PATCH /api/v1/films/:id updates film", async ({ request }) => {
  const patchRes = await request.patch(`/api/v1/films/${filmId}`, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    data: {
      title: `CRUD Film Updated ${TEST_ID}`,
      status: "inactive",
    },
  });

  expect(patchRes.status()).toBe(200);
  const patchBody = await patchRes.json();
  expect(patchBody.data.title).toBe(`CRUD Film Updated ${TEST_ID}`);
  expect(patchBody.data.status).toBe("inactive");
});

test("DELETE /api/v1/films/:id archives film", async ({ request }) => {
  const deleteRes = await request.delete(`/api/v1/films/${filmId}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  expect(deleteRes.status()).toBe(200);
  const deleteBody = await deleteRes.json();
  expect(deleteBody.data.archived).toBe(true);

  const getRes = await request.get(`/api/v1/films/${filmId}`, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });
  expect(getRes.status()).toBe(404);
});
