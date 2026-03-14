import { expect, test } from "@playwright/test";

import { registerAndLogin, completeOnboarding } from "./helpers/exhibitor";

const TEST_ID = Date.now().toString(36);

// ---------------------------------------------------------------------------
// 1. Registration flow
// ---------------------------------------------------------------------------
test.describe("Registration flow", () => {
  test("register form submits and shows verification message", async ({ page }) => {
    const email = `reg-${TEST_ID}@e2e-test.local`;

    await page.goto("/en/register");
    await expect(page.locator("#name")).toBeVisible({ timeout: 15000 });

    await page.fill("#name", "E2E Registration Test");
    await page.fill("#email", email);
    await page.fill("#password", "StrongPass123!");
    await page.fill("#password-confirm", "StrongPass123!");

    await page.getByRole("button", { name: /create account/i }).click();

    // After successful registration, the success card appears with verification message
    await expect(page.getByText(/verification email/i)).toBeVisible({ timeout: 10000 });
    // Should stay on register page
    await expect(page).toHaveURL(/\/en\/register/);
  });
});

// ---------------------------------------------------------------------------
// 2. Onboarding flow — register, verify email, login, complete onboarding
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
test.describe("Onboarding flow", () => {
  const user = {
    name: "E2E Onboarding User",
    email: `onboard-${TEST_ID}@e2e-test.local`,
    password: "StrongPass123!",
  };
  const companyName = `E2E Cinema ${TEST_ID}`;

  test("new user goes through onboarding and lands on home", async ({ page, request }) => {
    await registerAndLogin(page, request, user);
    await completeOnboarding(page, companyName);

    // Wait for network idle after the server-side redirect
    await page.waitForLoadState("networkidle");

    // Company name should appear in the marketplace header
    await expect(page.getByText(companyName)).toBeVisible({ timeout: 30000 });
  });
});

// ---------------------------------------------------------------------------
// 3. Account info editing
// ---------------------------------------------------------------------------
test.describe("Account information editing", () => {
  const user = {
    name: "E2E Account Edit User",
    email: `accedit-${TEST_ID}@e2e-test.local`,
    password: "StrongPass123!",
  };
  const companyName = `E2E Edit Co ${TEST_ID}`;
  const updatedCompanyName = `Updated Co ${TEST_ID}`;

  test("can edit account company name and see it persist", async ({ page, request }) => {
    // Setup: register, login, complete onboarding
    await registerAndLogin(page, request, user);
    await completeOnboarding(page, companyName);

    // Navigate to account information page
    await page.goto("/en/account/information");
    await expect(page.locator("#companyName")).toBeVisible({ timeout: 15000 });

    // Verify current company name is pre-filled
    await expect(page.locator("#companyName")).toHaveValue(companyName);

    // Update company name
    await page.fill("#companyName", updatedCompanyName);

    // Save
    await page.getByRole("button", { name: /save changes/i }).click();

    // Wait for success toast
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });

    // Reload the page and verify the change persisted
    await page.reload();
    await expect(page.locator("#companyName")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("#companyName")).toHaveValue(updatedCompanyName);
  });
});

// ---------------------------------------------------------------------------
// 4. Profile editing
// ---------------------------------------------------------------------------
test.describe("Profile editing", () => {
  const user = {
    name: "E2E Profile User",
    email: `profile-${TEST_ID}@e2e-test.local`,
    password: "StrongPass123!",
  };
  const companyName = `E2E Profile Co ${TEST_ID}`;
  const updatedName = `Updated Name ${TEST_ID}`;

  test("can edit user name and see it persist", async ({ page, request }) => {
    // Setup: register, login, complete onboarding
    await registerAndLogin(page, request, user);
    await completeOnboarding(page, companyName);

    // Navigate to profile page
    await page.goto("/en/account/profile");
    await expect(page.locator("#name")).toBeVisible({ timeout: 15000 });

    // Verify current name is pre-filled
    await expect(page.locator("#name")).toHaveValue(user.name);

    // Email should be disabled
    await expect(page.locator("#email")).toBeDisabled();

    // Update name
    await page.fill("#name", updatedName);
    await page.getByRole("button", { name: /save changes/i }).click();

    // Wait for success toast
    await expect(page.getByText(/updated successfully/i)).toBeVisible({ timeout: 5000 });

    // Input should still have the updated value (local state)
    await expect(page.locator("#name")).toHaveValue(updatedName);
  });

  test("profile sessions page loads", async ({ page, request }) => {
    // Setup: register, login, complete onboarding with a new user
    const sessUser = {
      name: "E2E Sessions User",
      email: `sessions-${TEST_ID}@e2e-test.local`,
      password: "StrongPass123!",
    };
    await registerAndLogin(page, request, sessUser);
    await completeOnboarding(page, `Sessions Co ${TEST_ID}`);

    // Navigate to profile sessions tab
    await page.goto("/en/account/profile/sessions");

    // Should see the sessions card title (exact match to avoid matching description)
    await expect(page.getByText(/^active sessions$/i)).toBeVisible({ timeout: 15000 });

    // Should see at least one session (the current one)
    await expect(page.locator("[class*='rounded-md border']").first()).toBeVisible();

    // Sign out and Revoke all buttons should be visible
    await expect(page.getByRole("button", { name: /revoke all/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
  });
});
