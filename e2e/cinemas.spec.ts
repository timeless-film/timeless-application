import { expect, test } from "@playwright/test";

import { setupExhibitor } from "./helpers/exhibitor";

const TEST_ID = Date.now().toString(36);

// ---------------------------------------------------------------------------
// Cinema management tests
// ---------------------------------------------------------------------------
test.describe("Cinema management", () => {
  test("cinema created in onboarding appears in /account/cinemas", async ({ page, request }) => {
    const { cinemaName } = await setupExhibitor(page, request, "cinema-list");

    await page.goto("/en/account/cinemas");
    await expect(page.getByText(cinemaName)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/1 screen/i)).toBeVisible();
  });

  test("can edit a cinema name", async ({ page, request }) => {
    const { cinemaName } = await setupExhibitor(page, request, "cinema-edit");

    await page.goto("/en/account/cinemas");
    await expect(page.getByText(cinemaName)).toBeVisible({ timeout: 15000 });

    // Click accordion to expand
    await page.getByText(cinemaName).click();

    // Find and edit the name field in the expanded accordion
    const nameInput = page.locator("input[id^='name-']").first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(`Updated Cinema ${TEST_ID}`);

    // Save
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText(/cinema updated/i)).toBeVisible({ timeout: 5000 });

    // Reload and verify persistence
    await page.reload();
    await expect(page.getByText(`Updated Cinema ${TEST_ID}`)).toBeVisible({ timeout: 15000 });
  });

  test("can add a second cinema", async ({ page, request }) => {
    const { cinemaName } = await setupExhibitor(page, request, "cinema-add");

    await page.goto("/en/account/cinemas");
    await expect(page.getByText(cinemaName)).toBeVisible({ timeout: 15000 });

    // Click "Add a cinema"
    await page.getByRole("button", { name: /add a cinema/i }).click();

    // Fill in the form
    await expect(page.locator("#cinemaName")).toBeVisible({ timeout: 5000 });
    await page.fill("#cinemaName", `Second Cinema ${TEST_ID}`);
    await page.fill("#cinemaCity", "Lyon");

    // Submit
    await page.getByRole("button", { name: /^add cinema$/i }).click();
    await expect(page.getByText(/cinema added/i)).toBeVisible({ timeout: 5000 });

    // Verify cinema appears in the list
    await expect(page.getByText(`Second Cinema ${TEST_ID}`)).toBeVisible({ timeout: 5000 });
  });

  test("default screen is created with new cinema", async ({ page, request }) => {
    await setupExhibitor(page, request, "cinema-defroom");

    await page.goto("/en/account/cinemas");

    // Add a second cinema
    await page.getByRole("button", { name: /add a cinema/i }).click();
    await expect(page.locator("#cinemaName")).toBeVisible({ timeout: 5000 });
    await page.fill("#cinemaName", `Default Room Cinema ${TEST_ID}`);
    await page.fill("#cinemaCity", "Marseille");
    await page.getByRole("button", { name: /^add cinema$/i }).click();
    await expect(page.getByText(/cinema added/i)).toBeVisible({ timeout: 5000 });

    // Expand the new cinema
    await page.getByText(`Default Room Cinema ${TEST_ID}`).click();

    // Should see "100 seats" for the default room
    await expect(page.getByText(/100 seats/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("can archive a cinema (not the last one)", async ({ page, request }) => {
    await setupExhibitor(page, request, "cinema-archive");

    await page.goto("/en/account/cinemas");

    // First add a second cinema
    await page.getByRole("button", { name: /add a cinema/i }).click();
    await expect(page.locator("#cinemaName")).toBeVisible({ timeout: 5000 });
    await page.fill("#cinemaName", `Archive Target ${TEST_ID}`);
    await page.fill("#cinemaCity", "Bordeaux");
    await page.getByRole("button", { name: /^add cinema$/i }).click();
    await expect(page.getByText(/cinema added/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(`Archive Target ${TEST_ID}`)).toBeVisible({ timeout: 5000 });

    // Expand the second cinema and archive it
    await page.getByText(`Archive Target ${TEST_ID}`).click();
    await page.getByRole("button", { name: /^archive$/i }).last().click();

    // Confirm in dialog
    await expect(page.getByText(/archive cinema/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /^archive$/i }).last().click();

    // Verify toast + cinema disappears
    await expect(page.getByText(/cinema archived/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /^archive$/i })).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(`Archive Target ${TEST_ID}`, { exact: true })).not.toBeVisible({ timeout: 5000 });
  });

  test("cannot archive the last cinema", async ({ page, request }) => {
    const { cinemaName } = await setupExhibitor(page, request, "cinema-last");

    await page.goto("/en/account/cinemas");
    await expect(page.getByText(cinemaName)).toBeVisible({ timeout: 15000 });

    // Expand the only cinema
    await page.getByText(cinemaName).click();

    // Click archive
    await page.getByRole("button", { name: /^archive$/i }).first().click();

    // Confirm in dialog
    await expect(page.getByText(/archive cinema/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /^archive$/i }).last().click();

    // Should see error toast
    await expect(page.getByText(/must keep at least one cinema/i)).toBeVisible({
      timeout: 5000,
    });
  });
});

// ---------------------------------------------------------------------------
// Screen (room) management tests
// ---------------------------------------------------------------------------
test.describe("Screen management", () => {
  test("can add a screen via dialog", async ({ page, request }) => {
    const { cinemaName } = await setupExhibitor(page, request, "screen-add");

    await page.goto("/en/account/cinemas");
    await expect(page.getByText(cinemaName)).toBeVisible({ timeout: 15000 });

    // Expand cinema
    await page.getByText(cinemaName).click();

    // Click "Add a screen"
    await page.getByRole("button", { name: /add a screen/i }).click();

    // Fill dialog form
    await expect(page.locator("#roomCapacity")).toBeVisible({ timeout: 5000 });
    await page.fill("#roomName", `VIP Screen ${TEST_ID}`);
    await page.fill("#roomCapacity", "250");
    await page.fill("#roomReference", "VIP-001");

    // Submit
    await page.getByRole("button", { name: /^add screen$/i }).click();
    await expect(page.getByText(/screen added/i)).toBeVisible({ timeout: 5000 });

    // Verify screen appears in the list
    await expect(page.getByText(`VIP Screen ${TEST_ID}`)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/250 seats/i)).toBeVisible();
  });

  test("can edit a screen via dialog", async ({ page, request }) => {
    const { cinemaName } = await setupExhibitor(page, request, "screen-edit");

    await page.goto("/en/account/cinemas");
    await expect(page.getByText(cinemaName)).toBeVisible({ timeout: 15000 });

    // Expand cinema
    await page.getByText(cinemaName).click();

    // Click edit button on the first room (square-pen icon)
    const editButton = page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-square-pen") })
      .first();
    await editButton.click();

    // Edit dialog should open
    await expect(page.locator("#roomCapacity")).toBeVisible({ timeout: 5000 });
    await page.fill("#roomCapacity", "200");
    await page.fill("#roomReference", "MAIN-001");

    // Save
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText(/screen updated/i)).toBeVisible({ timeout: 5000 });

    // Verify change
    await expect(page.getByText(/200 seats/i)).toBeVisible({ timeout: 5000 });
  });

  test("auto-increments screen name when left empty", async ({ page, request }) => {
    const { cinemaName } = await setupExhibitor(page, request, "screen-auto");

    await page.goto("/en/account/cinemas");
    await expect(page.getByText(cinemaName)).toBeVisible({ timeout: 15000 });

    // Expand cinema
    await page.getByText(cinemaName).click();

    // Add a screen without a name
    await page.getByRole("button", { name: /add a screen/i }).click();
    await expect(page.locator("#roomCapacity")).toBeVisible({ timeout: 5000 });
    // Leave name empty, only set capacity
    await page.fill("#roomCapacity", "80");

    await page.getByRole("button", { name: /^add screen$/i }).click();
    await expect(page.getByText(/screen added/i)).toBeVisible({ timeout: 5000 });

    // The auto-generated name should be "Salle 2" (since default "Salle 1" exists)
    await expect(page.getByText(/Salle 2/)).toBeVisible({ timeout: 5000 });
  });

  test("cannot archive the last screen", async ({ page, request }) => {
    const { cinemaName } = await setupExhibitor(page, request, "screen-last");

    await page.goto("/en/account/cinemas");
    await expect(page.getByText(cinemaName)).toBeVisible({ timeout: 15000 });

    // Expand cinema
    await page.getByText(cinemaName).click();

    // Click archive (archive icon) on the only room — first archive icon button in DOM
    // (room buttons appear before cinema archive button in accordion order)
    const archiveButton = page
      .locator("button")
      .filter({ has: page.locator("svg.lucide-archive") })
      .first();
    await archiveButton.click();

    // Confirm in dialog
    await expect(page.getByText(/archive screen/i)).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /^archive$/i }).last().click();

    // Should see error
    await expect(page.getByText(/must keep at least one screen/i)).toBeVisible({
      timeout: 5000,
    });
  });
});
