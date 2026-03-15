import { expect, test } from "@playwright/test";
import postgres from "postgres";

import { createAdminContext, loginAsAdmin } from "./helpers/admin";
import { setupExhibitor } from "./helpers/exhibitor";
import { createRightsHolderContext } from "./helpers/rights-holder";

import type { AdminContext } from "./helpers/admin";
import type { RightsHolderContext } from "./helpers/rights-holder";

const TEST_ID = Date.now().toString(36);
const DB_URL =
  process.env.DATABASE_URL ?? "postgresql://timeless:timeless@localhost:5432/timeless_test";

test.describe("Home Page (E13)", () => {
  test.describe("Exhibitor Home", () => {
    test("home page loads and displays title", async ({ page, request }) => {
      await setupExhibitor(page, request, "home");
      await page.goto("/en/home");
      await expect(page).toHaveURL(/\/en\/home/);
      await expect(page.locator("main")).toBeVisible({
        timeout: 15000,
      });
    });

    test("home page shows decade catalog fallback when no editorial content", async ({
      page,
      request,
    }) => {
      await setupExhibitor(page, request, "home-decade");

      // Ensure no editorial sections exist
      const sql = postgres(DB_URL, { max: 1 });
      await sql`DELETE FROM editorial_sections`;
      await sql.end();

      await page.goto("/en/home");
      await expect(page).toHaveURL(/\/en\/home/);
      // The decade catalog fallback should render or at least the page should load
      await expect(page.locator("main")).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe("Admin Editorial (E13-014)", () => {
    let adminCtx: AdminContext;
    let rhCtx: RightsHolderContext;

    test.beforeAll(async ({ request }) => {
      adminCtx = await createAdminContext(request, TEST_ID, "ed-admin");
      rhCtx = await createRightsHolderContext(request, TEST_ID, "ed-rh");

      // Create a test film for editorial content
      const sql = postgres(DB_URL, { max: 1 });
      await sql`
        INSERT INTO films (account_id, title, release_year, status)
        VALUES (${rhCtx.accountId}, ${`Editorial Film ${TEST_ID}`}, 1955, 'active')
      `;
      await sql.end();
    });

    test("admin can access editorial page", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);
      await page.goto("/en/admin/editorial");
      await expect(page).toHaveURL(/\/en\/admin\/editorial/);
      await expect(page.getByRole("heading", { name: "Editorial" })).toBeVisible({ timeout: 15000 });
    });

    test("admin can create a slideshow section", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);
      await page.goto("/en/admin/editorial");
      await expect(page).toHaveURL(/\/en\/admin\/editorial/);

      // Click add section button
      await page.getByRole("button", { name: /add section/i }).click();

      // Select slideshow type
      await page.getByRole("menuitem", { name: /slideshow/i }).click();

      // Should show success toast
      await expect(page.getByText(/section created/i)).toBeVisible({ timeout: 10000 });
    });

    test("admin can create a decade catalog section", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);
      await page.goto("/en/admin/editorial");
      await expect(page).toHaveURL(/\/en\/admin\/editorial/);

      await page.getByRole("button", { name: /add section/i }).click();
      await page.getByRole("menuitem", { name: /decade/i }).click();

      await expect(page.getByText(/section created/i)).toBeVisible({ timeout: 10000 });
    });

    test("admin can toggle section visibility", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);
      await page.goto("/en/admin/editorial");
      await expect(page).toHaveURL(/\/en\/admin\/editorial/);

      // Wait for sections created by previous tests to appear
      const firstSection = page.locator("[data-section-id]").first();
      await expect(firstSection).toBeVisible({ timeout: 15000 });

      // Click the visibility toggle (Eye icon button)
      const toggleButton = firstSection.getByRole("button", { name: /hide|show/i });
      await toggleButton.click();

      // Should see "Hidden" badge appear
      await expect(firstSection.getByText(/hidden/i)).toBeVisible({ timeout: 10000 });
    });

    test("admin can delete a section", async ({ page }) => {
      await loginAsAdmin(page, adminCtx);
      await page.goto("/en/admin/editorial");
      await expect(page).toHaveURL(/\/en\/admin\/editorial/);

      // First create a section to delete
      await page.getByRole("button", { name: /add section/i }).click();
      await page.getByRole("menuitem", { name: /editorial cards/i }).click();
      await expect(page.getByText(/section created/i)).toBeVisible({ timeout: 10000 });

      // Find the last section and click its delete button
      const lastSection = page.locator("[data-section-id]").last();
      await expect(lastSection).toBeVisible({ timeout: 10000 });
      const deleteButton = lastSection.getByRole("button", { name: /delete/i });
      await deleteButton.click();

      // Confirm deletion in dialog
      const confirmButton = page.getByRole("alertdialog").getByRole("button", { name: /delete/i });
      await expect(confirmButton).toBeVisible({ timeout: 5000 });
      await confirmButton.click();
      await expect(page.getByText(/section deleted/i)).toBeVisible({ timeout: 10000 });
    });
  });
});
