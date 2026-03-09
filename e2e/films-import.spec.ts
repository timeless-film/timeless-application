import { expect, test } from "@playwright/test";

import { createRightsHolderContext, loginAsRightsHolder } from "./helpers/rights-holder";

const TEST_ID = Date.now().toString(36);

test("import wizard shows mapping, preview and confirm with auto-enrich option", async ({
  page,
  request,
}) => {
  const context = await createRightsHolderContext(request, TEST_ID, "films-import");

  await loginAsRightsHolder(page, context);
  await page.goto("/en/films/import");

  await expect(page.getByRole("heading", { name: /import films from csv/i })).toBeVisible({
    timeout: 15000,
  });

  const csvContent = [
    "Identifier,Title,Type,Countries,Price,Currency,Status",
    `IMP-${TEST_ID},Imported Film ${TEST_ID},direct,FR,123,EUR,active`,
  ].join("\n");

  await page.setInputFiles("input[type='file']", {
    name: `films-${TEST_ID}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(csvContent, "utf8"),
  });

  await expect(page.getByText(/^Map columns$/i).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/preview \(first 10 rows\)/i)).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: /^next$/i }).click();
  await expect(page.getByText(/^1 film\(s\) to create$/i).first()).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: /^next$/i }).click();
  await expect(page.getByText(/^Confirm import$/i).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/automatically enrich imported films/i)).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: /import 1 film/i }).click();

  await expect(page).toHaveURL(/\/en\/films$/, { timeout: 30000 });
  await expect(page.getByText(`Imported Film ${TEST_ID}`)).toBeVisible({ timeout: 15000 });
});
