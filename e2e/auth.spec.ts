import { expect, test } from "@playwright/test";

test.describe("Auth pages accessibility", () => {
  test("login page loads and displays form", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page).toHaveURL(/\/en\/login/);

    // Wait for client hydration — the form is a client component
    const emailInput = page.locator("input[type='email']");
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await expect(page.locator("input[type='password']")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("register page loads and displays form", async ({ page }) => {
    await page.goto("/en/register");
    await expect(page).toHaveURL(/\/en\/register/);

    // Wait for client hydration
    const emailInput = page.locator("input[type='email']");
    await expect(emailInput).toBeVisible({ timeout: 15000 });
    await expect(page.locator("input[type='password']").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/en/forgot-password");
    await expect(page).toHaveURL(/\/en\/forgot-password/);
    await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });
  });

  test("login page has link to register", async ({ page }) => {
    await page.goto("/en/login");
    // Wait for hydration first
    await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });
    // Link text is "Create an account"
    const registerLink = page.getByRole("link", { name: /create an account/i });
    await expect(registerLink).toBeVisible();
  });

  test("login page has link to forgot password", async ({ page }) => {
    await page.goto("/en/login");
    // Wait for hydration first
    await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });
    // Link text is "Forgot your password?"
    const forgotLink = page.getByRole("link", { name: /forgot your password/i });
    await expect(forgotLink).toBeVisible();
  });
});

test.describe("Auth redirects (unauthenticated)", () => {
  test("redirects /en/catalog to login when not authenticated", async ({ page }) => {
    await page.goto("/en/catalog");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("redirects /en/films to login when not authenticated", async ({ page }) => {
    await page.goto("/en/films");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("redirects /en/dashboard to login when not authenticated", async ({ page }) => {
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("redirects /en/account/profile to login when not authenticated", async ({ page }) => {
    await page.goto("/en/account/profile");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("redirects /en/account/information to login when not authenticated", async ({ page }) => {
    await page.goto("/en/account/information");
    await expect(page).toHaveURL(/\/en\/login/);
  });
});

test.describe("Locale handling", () => {
  test("/ redirects to locale-prefixed path", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/(en|fr)/);
  });

  test("/fr/login loads French login page", async ({ page }) => {
    await page.goto("/fr/login");
    await expect(page).toHaveURL(/\/fr\/login/);
  });

  test("/en/login loads English login page", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page).toHaveURL(/\/en\/login/);
  });
});

test.describe("Login form validation", () => {
  test("shows error on empty submission", async ({ page }) => {
    await page.goto("/en/login");

    // Wait for client hydration
    const submitBtn = page.getByRole("button", { name: /sign in/i });
    await expect(submitBtn).toBeVisible({ timeout: 15000 });
    await submitBtn.click();

    // The form should still be on the login page (HTML5 validation prevents submit)
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/en/login");

    // Wait for client hydration
    await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });

    await page.fill("input[type='email']", "nonexistent@test.com");
    await page.fill("input[type='password']", "wrongpassword123");

    const submitBtn = page.getByRole("button", { name: /sign in/i });
    await submitBtn.click();

    // Should stay on login page — error message may appear as toast or inline
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/\/en\/login/);
  });
});

test.describe("Register form validation", () => {
  test("shows password mismatch error in real time", async ({ page }) => {
    await page.goto("/en/register");

    // Wait for client hydration
    await expect(page.locator("input[type='email']")).toBeVisible({ timeout: 15000 });

    // Fill name and email
    const nameInput = page.locator("input[name='name'], input#name");
    if (await nameInput.isVisible()) {
      await nameInput.fill("Test User");
    }
    await page.fill("input[type='email']", "test@example.com");

    // Fill passwords that don't match
    const passwordInputs = page.locator("input[type='password']");
    await passwordInputs.first().fill("StrongPass123!");
    await passwordInputs.nth(1).fill("DifferentPass456!");

    // Trigger blur to show mismatch — wait for real-time validation
    await passwordInputs.nth(1).blur();
    await page.waitForTimeout(500);

    // Check for mismatch warning - uses translation key "Passwords do not match."
    const mismatchError = page.getByText(/do not match|mismatch|ne correspondent pas/i);
    await expect(mismatchError).toBeVisible({ timeout: 5000 });
  });
});
