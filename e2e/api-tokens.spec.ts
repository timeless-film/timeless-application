import { expect, test } from "@playwright/test";

import { setupExhibitor } from "./helpers/exhibitor";

const TEST_ID = Date.now().toString(36);

// ---------------------------------------------------------------------------
// API tokens tests
// ---------------------------------------------------------------------------
test.describe("API tokens", () => {
  test("API tab is visible for owner", async ({ page, request }) => {
    await setupExhibitor(page, request, "apitoken-tab");

    await page.goto("/en/account/information");
    await expect(page.getByText(/^api$/i)).toBeVisible({ timeout: 15000 });
  });

  test("can create a token and see it once", async ({ page, request }) => {
    await setupExhibitor(page, request, "apitoken-create");

    await page.goto("/en/account/api");

    // Should see empty state
    await expect(page.getByText(/no api keys yet/i)).toBeVisible({ timeout: 15000 });

    // Click create button
    await page.getByRole("button", { name: /create an api key/i }).click();

    // Fill dialog
    await expect(page.locator("#token-name")).toBeVisible({ timeout: 5000 });
    await page.fill("#token-name", `Test Key ${TEST_ID}`);
    await page.getByRole("button", { name: /^create$/i }).click();

    // Token created — should see the raw token (starts with tmls_)
    await expect(page.getByText(/copy this key now/i)).toBeVisible({ timeout: 5000 });

    // The token input should contain tmls_
    const tokenInput = page.locator("input[readonly]");
    await expect(tokenInput).toBeVisible();
    const tokenValue = await tokenInput.inputValue();
    expect(tokenValue).toMatch(/^tmls_/);

    // Close the dialog (first match = primary Close button, second = dialog X icon)
    await page.getByRole("button", { name: /close/i }).first().click();

    // Token should no longer be visible in full — only prefix in the table
    await expect(page.getByText(`Test Key ${TEST_ID}`)).toBeVisible({ timeout: 5000 });
    // Full token should not be visible anymore
    await expect(tokenInput).not.toBeVisible();
  });

  test("can revoke a token", async ({ page, request }) => {
    await setupExhibitor(page, request, "apitoken-revoke");

    await page.goto("/en/account/api");

    // Create a token first
    await page.getByRole("button", { name: /create an api key/i }).click();
    await expect(page.locator("#token-name")).toBeVisible({ timeout: 5000 });
    await page.fill("#token-name", `Revoke Key ${TEST_ID}`);
    await page.getByRole("button", { name: /^create$/i }).click();
    await expect(page.getByText(/copy this key now/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /close/i }).first().click();

    // Verify token is in the table
    await expect(page.getByText(`Revoke Key ${TEST_ID}`)).toBeVisible({ timeout: 5000 });

    // Click revoke
    await page.getByRole("button", { name: /revoke/i }).click();

    // Confirm in dialog
    await expect(page.getByText(/revoke api key/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /revoke key/i }).click();

    // Should see success toast
    await expect(page.getByText(/api key revoked/i)).toBeVisible({ timeout: 5000 });

    // Token should disappear from the list
    await expect(page.getByText(`Revoke Key ${TEST_ID}`)).not.toBeVisible({ timeout: 5000 });
  });

  test("bearer token works for API calls", async ({ page, request }) => {
    await setupExhibitor(page, request, "apitoken-bearer");

    await page.goto("/en/account/api");

    // Create a token
    await page.getByRole("button", { name: /create an api key/i }).click();
    await expect(page.locator("#token-name")).toBeVisible({ timeout: 5000 });
    await page.fill("#token-name", `Bearer Key ${TEST_ID}`);
    await page.getByRole("button", { name: /^create$/i }).click();
    await expect(page.getByText(/copy this key now/i)).toBeVisible({ timeout: 5000 });

    // Capture the token value
    const tokenInput = page.locator("input[readonly]");
    const token = await tokenInput.inputValue();

    await page.getByRole("button", { name: /close/i }).first().click();

    // Use token for API call
    const response = await request.get("/api/v1/cinemas", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  test("invalid bearer token returns 401", async ({ request }) => {
    const response = await request.get("/api/v1/cinemas", {
      headers: {
        Authorization: "Bearer tmls_invalid_token_12345678901234567890",
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("missing bearer token returns 401", async ({ request }) => {
    const response = await request.get("/api/v1/cinemas");
    expect(response.status()).toBe(401);
  });
});
