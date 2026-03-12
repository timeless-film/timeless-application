import { expect, test } from "@playwright/test";

test.describe("Account management (unauthenticated)", () => {
  test("redirects /account/members to login", async ({ page }) => {
    await page.goto("/en/account/members");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("redirects /account/cinemas to login", async ({ page }) => {
    await page.goto("/en/account/cinemas");
    await expect(page).toHaveURL(/\/en\/login/);
  });
});

test.describe("API routes (unauthenticated)", () => {
  test("auth session endpoint returns 404 without valid session", async ({ request }) => {
    const response = await request.get("/api/auth/session", {
      headers: { Accept: "application/json" },
    });
    expect(response.status()).toBe(404);
  });
});

test.describe("Route protection by account type", () => {
  test("exhibitor paths redirect unauthenticated to login", async ({ page }) => {
    const exhibitorPaths = ["/en/catalog", "/en/cart", "/en/orders", "/en/requests"];

    for (const path of exhibitorPaths) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/en\/login/, {
        timeout: 5000,
      });
    }
  });

  test("rights holder paths redirect unauthenticated to login", async ({ page }) => {
    const rhPaths = ["/en/films", "/en/validation-requests", "/en/wallet"];

    for (const path of rhPaths) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/en\/login/, {
        timeout: 5000,
      });
    }
  });

  test("admin paths redirect unauthenticated to login", async ({ page }) => {
    const adminPaths = ["/en/admin/dashboard", "/en/admin/exhibitors", "/en/admin/rights-holders", "/en/admin/settings"];

    for (const path of adminPaths) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/en\/login/, {
        timeout: 5000,
      });
    }
  });
});
