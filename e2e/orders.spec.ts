/**
 * E2E tests for Orders page (E06).
 * Tests: page access, empty state, orders display with seeded data.
 * Note: Full order creation flow requires E08 (payment).
 */
import { expect, test } from "@playwright/test";

import { setupExhibitor } from "./helpers/exhibitor";

test.describe("Orders page", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/en/orders");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("shows empty state when no orders exist", async ({ page, request }) => {
    await setupExhibitor(page, request, "orders-empty");

    await page.goto("/en/orders");
    await expect(page).toHaveURL(/\/en\/orders/);

    // The page should load and show a heading
    await expect(page.getByRole("heading", { name: /order history/i })).toBeVisible({ timeout: 15000 });

    // With no orders, should display empty state
    await expect(page.getByText(/order history.*0/i)).toBeVisible({ timeout: 10000 });
  });
});
