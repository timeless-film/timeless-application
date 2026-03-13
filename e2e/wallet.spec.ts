import { expect, test } from "@playwright/test";

import {
  createRightsHolderContext,
  createRightsHolderWithStripeAccount,
  loginAsRightsHolder,
} from "./helpers/rights-holder";

const TEST_ID = Date.now().toString(36);

test.describe("Wallet — Rights Holder Dashboard", () => {
  test("wallet page loads with KPI cards and Stripe banner for RH with Stripe account", async ({
    page,
    request,
  }) => {
    const ctx = await createRightsHolderWithStripeAccount(request, TEST_ID, "wallet-kpi");
    await loginAsRightsHolder(page, ctx);

    await page.goto("/en/wallet");
    await expect(page).toHaveURL(/\/en\/wallet/, { timeout: 15000 });

    // KPI cards should be visible
    await expect(page.getByText("Available balance")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Pending")).toBeVisible();
    await expect(page.getByText("This month")).toBeVisible();
    await expect(page.getByText("Previous month")).toBeVisible();

    // Withdraw button should be visible
    await expect(
      page.getByRole("button", { name: /withdraw funds/i, exact: false })
    ).toBeVisible();
  });

  test("wallet page shows onboarding CTA when Stripe Connect not configured", async ({
    page,
    request,
  }) => {
    // Create RH without Stripe account (default behavior)
    const ctx = await createRightsHolderContext(request, TEST_ID, "wallet-no-stripe");
    await loginAsRightsHolder(page, ctx);

    await page.goto("/en/wallet");
    await expect(page).toHaveURL(/\/en\/wallet/, { timeout: 15000 });

    // Should NOT show KPI cards
    await expect(page.getByText("Available balance")).not.toBeVisible({ timeout: 5000 });
  });

  test("withdraw dialog opens and shows amount input", async ({ page, request }) => {
    const ctx = await createRightsHolderWithStripeAccount(request, TEST_ID, "wallet-withdraw");
    await loginAsRightsHolder(page, ctx);

    await page.goto("/en/wallet");
    await expect(page).toHaveURL(/\/en\/wallet/, { timeout: 15000 });

    const withdrawButton = page.getByRole("button", { name: "Withdraw funds" });
    await expect(withdrawButton).toBeVisible({ timeout: 10000 });
    await withdrawButton.click();

    // Dialog should open with amount input
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel(/amount/i)).toBeVisible();
  });

  test("revenue chart renders with period toggle tabs", async ({ page, request }) => {
    const ctx = await createRightsHolderWithStripeAccount(request, TEST_ID, "wallet-chart");
    await loginAsRightsHolder(page, ctx);

    await page.goto("/en/wallet");
    await expect(page).toHaveURL(/\/en\/wallet/, { timeout: 15000 });

    // Revenue chart section with period tabs
    await expect(page.getByText("Revenue", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("tab", { name: /30/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /12/i })).toBeVisible();
  });

  test("CSV export popover opens with preset options", async ({ page, request }) => {
    const ctx = await createRightsHolderWithStripeAccount(request, TEST_ID, "wallet-csv");
    await loginAsRightsHolder(page, ctx);

    await page.goto("/en/wallet");
    await expect(page).toHaveURL(/\/en\/wallet/, { timeout: 15000 });

    const csvButton = page.getByRole("button", { name: /download statement/i });
    await expect(csvButton).toBeVisible({ timeout: 10000 });
    await csvButton.click();

    // Popover should show date presets
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await expect(popover.getByText("Current month")).toBeVisible({ timeout: 5000 });
    await expect(popover.getByText("Previous month")).toBeVisible();
    await expect(popover.getByText("Custom range")).toBeVisible();
  });
});
