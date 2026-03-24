import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";
import postgres from "postgres";

import {
  createRightsHolderContext,
  loginAsRightsHolder,
} from "./helpers/rights-holder";

/**
 * E14 — TMDB Enrichment & Normalized Data E2E Tests
 *
 * Verifies:
 * 1. Exhibitor film detail page shows enriched TMDB data (crew, companies, genres, tagline, rating)
 * 2. Rights holder film detail page shows the enriched info card
 * 3. Catalog filter sidebar shows director/actor/company pickers and filters work
 */

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://timeless:timeless@localhost:5432/timeless_test";
const BASE_URL = `http://localhost:${process.env.PLAYWRIGHT_PORT ?? 3099}`;

const TEST_ID = Date.now().toString(36);

test.describe("E14 — TMDB Enrichment", () => {
  let dbSql: ReturnType<typeof postgres>;

  let rhCtx: Awaited<ReturnType<typeof createRightsHolderContext>>;

  let exhibitorUserId: string;
  let exhibitorAccountId: string;
  let exhibitorEmail: string;
  const exhibitorPassword = "StrongPass123!";

  let filmId: string;
  let film2Id: string;
  let cinemaId: string;

  test.beforeAll(async ({ request }) => {
    dbSql = postgres(DATABASE_URL, { max: 1 });

    // ── Platform settings ──
    await dbSql`
      INSERT INTO platform_settings (id)
      VALUES ('global')
      ON CONFLICT (id) DO NOTHING
    `;

    // ── Rights holder ──
    rhCtx = await createRightsHolderContext(request, TEST_ID, "e14-rh");

    // ── Exhibitor account (manual — no UI needed) ──
    const suffix = randomBytes(4).toString("hex");
    exhibitorEmail = `e14-exh-${TEST_ID}-${suffix}@e2e-test.local`;

    const signupRes = await request.post("/api/auth/sign-up/email", {
      data: {
        name: "E14 Exhibitor",
        email: exhibitorEmail,
        password: exhibitorPassword,
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(signupRes.ok()).toBeTruthy();

    await dbSql`UPDATE better_auth_users SET email_verified = true WHERE email = ${exhibitorEmail}`;

    const [user] =
      await dbSql`SELECT id FROM better_auth_users WHERE email = ${exhibitorEmail}`;
    if (!user) throw new Error("Failed to retrieve exhibitor user");
    exhibitorUserId = user.id;

    const [account] = await dbSql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('exhibitor', ${`E14 Exhibitor ${TEST_ID}`}, 'FR', true)
      RETURNING id
    `;
    if (!account) throw new Error("Failed to create exhibitor account");
    exhibitorAccountId = account.id;

    await dbSql`
      INSERT INTO account_members (account_id, user_id, role)
      VALUES (${exhibitorAccountId}, ${exhibitorUserId}, 'owner')
    `;

    // ── Cinema ──
    const [cinema] = await dbSql`
      INSERT INTO cinemas (account_id, name, country, city)
      VALUES (${exhibitorAccountId}, ${`Cinema E14 ${TEST_ID}`}, 'FR', 'Paris')
      RETURNING id
    `;
    if (!cinema) throw new Error("Failed to create cinema");
    cinemaId = cinema.id;

    await dbSql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinemaId}, 'Salle 1', 100)
    `;

    // ── Seed genres ──
    const genreRows = await dbSql`
      INSERT INTO genres (tmdb_id, name_en, name_fr) VALUES
        (18, 'Drama', 'Drame'),
        (80, 'Crime', 'Crime'),
        (53, 'Thriller', 'Thriller'),
        (35, 'Comedy', 'Comédie')
      ON CONFLICT (tmdb_id) DO UPDATE SET name_en = EXCLUDED.name_en
      RETURNING id, tmdb_id
    `;
    const genreMap = new Map<number, number>();
    for (const row of genreRows) {
      genreMap.set(row.tmdb_id as number, row.id as number);
    }

    // ── Film 1 — fully enriched ──
    const [film] = await dbSql`
      INSERT INTO films (
        account_id, title, original_title, type, status,
        release_year, duration, directors, "cast", genres, countries,
        synopsis, tmdb_rating, tagline, tagline_en
      ) VALUES (
        ${rhCtx.accountId},
        'The Third Man',
        'The Third Man',
        'direct', 'active',
        1949, 104,
        ARRAY['Carol Reed'],
        ARRAY['Joseph Cotten', 'Orson Welles'],
        ARRAY['Drama', 'Thriller'],
        ARRAY['GB'],
        'A masterpiece of noir cinema set in post-war Vienna.',
        '8.1',
        'Traqué dans les ombres de Vienne',
        'Hunted in the shadows of Vienna'
      ) RETURNING id
    `;
    if (!film) throw new Error("Failed to create film 1");
    filmId = film.id;

    // Price for FR
    await dbSql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${filmId}, ARRAY['FR'], 80000, 'EUR')
    `;

    // Normalized TMDB data for film 1
    const dramaId = genreMap.get(18)!;
    const thrillerId = genreMap.get(53)!;
    const crimeId = genreMap.get(80)!;
    await dbSql`
      INSERT INTO film_genres (film_id, genre_id) VALUES
        (${filmId}, ${dramaId}),
        (${filmId}, ${thrillerId})
    `;

    await dbSql`
      INSERT INTO film_people (film_id, name, role, character, display_order, tmdb_person_id) VALUES
        (${filmId}, 'Carol Reed', 'director', NULL, 0, 14426),
        (${filmId}, 'Joseph Cotten', 'actor', 'Holly Martins', 1, 2638),
        (${filmId}, 'Orson Welles', 'actor', 'Harry Lime', 2, 2637),
        (${filmId}, 'Trevor Howard', 'actor', 'Major Calloway', 3, 10655),
        (${filmId}, 'David O. Selznick', 'producer', NULL, 10, NULL),
        (${filmId}, 'Anton Karas', 'composer', NULL, 20, NULL),
        (${filmId}, 'Robert Krasker', 'cinematographer', NULL, 21, NULL),
        (${filmId}, 'Graham Greene', 'screenplay', NULL, 22, NULL)
    `;

    await dbSql`
      INSERT INTO film_companies (film_id, name, tmdb_company_id, origin_country) VALUES
        (${filmId}, 'London Film Productions', 1234, 'GB'),
        (${filmId}, 'British Lion Films', 5678, 'GB')
    `;

    // ── Film 2 — different director, shared actor ──
    const [film2] = await dbSql`
      INSERT INTO films (
        account_id, title, type, status,
        release_year, duration, directors, "cast", genres, countries
      ) VALUES (
        ${rhCtx.accountId},
        'Citizen Kane',
        'direct', 'active',
        1941, 119,
        ARRAY['Orson Welles'],
        ARRAY['Orson Welles', 'Joseph Cotten'],
        ARRAY['Drama'],
        ARRAY['US']
      ) RETURNING id
    `;
    if (!film2) throw new Error("Failed to create film 2");
    film2Id = film2.id;

    await dbSql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${film2Id}, ARRAY['FR'], 70000, 'EUR')
    `;

    await dbSql`
      INSERT INTO film_genres (film_id, genre_id) VALUES
        (${film2Id}, ${dramaId}),
        (${film2Id}, ${crimeId})
    `;

    await dbSql`
      INSERT INTO film_people (film_id, name, role, character, display_order) VALUES
        (${film2Id}, 'Orson Welles', 'director', NULL, 0),
        (${film2Id}, 'Orson Welles', 'actor', 'Charles Foster Kane', 1),
        (${film2Id}, 'Joseph Cotten', 'actor', 'Jedediah Leland', 2)
    `;

    await dbSql`
      INSERT INTO film_companies (film_id, name, tmdb_company_id, origin_country) VALUES
        (${film2Id}, 'RKO Radio Pictures', 9999, 'US')
    `;
  });

  test.afterAll(async () => {
    // Clean up in FK-safe order
    if (filmId) {
      await dbSql`DELETE FROM film_events WHERE film_id = ${filmId}`;
      await dbSql`DELETE FROM cart_items WHERE film_id = ${filmId}`;
      await dbSql`DELETE FROM film_companies WHERE film_id = ${filmId}`;
      await dbSql`DELETE FROM film_people WHERE film_id = ${filmId}`;
      await dbSql`DELETE FROM film_genres WHERE film_id = ${filmId}`;
      await dbSql`DELETE FROM film_prices WHERE film_id = ${filmId}`;
      await dbSql`DELETE FROM films WHERE id = ${filmId}`;
    }
    if (film2Id) {
      await dbSql`DELETE FROM film_events WHERE film_id = ${film2Id}`;
      await dbSql`DELETE FROM cart_items WHERE film_id = ${film2Id}`;
      await dbSql`DELETE FROM film_companies WHERE film_id = ${film2Id}`;
      await dbSql`DELETE FROM film_people WHERE film_id = ${film2Id}`;
      await dbSql`DELETE FROM film_genres WHERE film_id = ${film2Id}`;
      await dbSql`DELETE FROM film_prices WHERE film_id = ${film2Id}`;
      await dbSql`DELETE FROM films WHERE id = ${film2Id}`;
    }
    if (cinemaId) {
      await dbSql`DELETE FROM rooms WHERE cinema_id = ${cinemaId}`;
      await dbSql`DELETE FROM cinemas WHERE id = ${cinemaId}`;
    }
    if (exhibitorAccountId)
      await dbSql`DELETE FROM accounts WHERE id = ${exhibitorAccountId}`;
    if (rhCtx?.accountId)
      await dbSql`DELETE FROM accounts WHERE id = ${rhCtx.accountId}`;

    await dbSql.end();
  });

  // ─── Helper: sign in as exhibitor ──────────────────────────────────────────

  async function loginAsExhibitor(page: import("@playwright/test").Page) {
    const signInRes = await page.request.post("/api/auth/sign-in/email", {
      data: { email: exhibitorEmail, password: exhibitorPassword },
      headers: { "Content-Type": "application/json" },
    });
    expect(signInRes.ok()).toBeTruthy();

    await page.context().addCookies([
      {
        name: "active_account_id",
        value: `${exhibitorAccountId}:exhibitor`,
        url: BASE_URL,
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // E14-004 — Enriched Film Detail Pages
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Enriched film detail — exhibitor", () => {
    test("shows crew section with producers, composer, cinematographer, and screenplay", async ({
      page,
    }) => {
      await loginAsExhibitor(page);
      await page.goto(`/en/catalog/${filmId}`);

      // Crew card should be visible
      await expect(page.getByText("Crew")).toBeVisible({ timeout: 15000 });

      // Producers
      await expect(page.getByText("David O. Selznick")).toBeVisible();

      // Composer (labeled "Music")
      await expect(page.getByText("Music")).toBeVisible();
      await expect(page.getByText("Anton Karas")).toBeVisible();

      // Cinematographer (labeled "Cinematography")
      await expect(page.getByText("Cinematography")).toBeVisible();
      await expect(page.getByText("Robert Krasker")).toBeVisible();

      // Screenplay
      await expect(page.getByText("Screenplay")).toBeVisible();
      await expect(page.getByText("Graham Greene")).toBeVisible();
    });

    test("shows production companies", async ({ page }) => {
      await loginAsExhibitor(page);
      await page.goto(`/en/catalog/${filmId}`);

      await expect(page.getByText("Production", { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("London Film Productions")).toBeVisible();
      await expect(page.getByText("British Lion Films")).toBeVisible();
    });

    test("shows tagline and TMDB rating", async ({ page }) => {
      await loginAsExhibitor(page);
      await page.goto(`/en/catalog/${filmId}`);

      // Tagline (English for /en locale)
      await expect(
        page.getByText("Hunted in the shadows of Vienna")
      ).toBeVisible({ timeout: 15000 });

      // TMDB rating
      await expect(page.getByText("8.1 / 10")).toBeVisible();
    });

    test("shows localized genre names from normalized data", async ({
      page,
    }) => {
      await loginAsExhibitor(page);
      await page.goto(`/en/catalog/${filmId}`);

      // Genre names should come from genres table (English)
      await expect(page.getByText("Drama")).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("Thriller")).toBeVisible();
    });

    test("shows directors and cast with character names", async ({ page }) => {
      await loginAsExhibitor(page);
      await page.goto(`/en/catalog/${filmId}`);

      // Director
      await expect(page.getByText("Carol Reed")).toBeVisible({
        timeout: 15000,
      });

      // Cast with character names
      await expect(
        page.getByText("Joseph Cotten (Holly Martins)")
      ).toBeVisible();
      await expect(page.getByText("Orson Welles (Harry Lime)")).toBeVisible();
    });
  });

  test.describe("Enriched film detail — rights holder", () => {
    test("shows enriched info card with TMDB data", async ({ page }) => {
      await loginAsRightsHolder(page, rhCtx);
      await page.goto(`/en/films/${filmId}`);

      // The enriched info card title
      await expect(page.getByText("TMDB enriched data")).toBeVisible({
        timeout: 15000,
      });

      // Tagline
      await expect(
        page.getByText("Hunted in the shadows of Vienna")
      ).toBeVisible();

      // Rating
      await expect(page.getByText("8.1 / 10")).toBeVisible();

      // Director
      await expect(page.getByText("Carol Reed")).toBeVisible();

      // Cast
      await expect(
        page.getByText("Joseph Cotten (Holly Martins)")
      ).toBeVisible();

      // Companies
      await expect(page.getByText("London Film Productions")).toBeVisible();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // E14-005 — Advanced Catalog Filters
  // ═══════════════════════════════════════════════════════════════════════════

  test.describe("Catalog filters — directors, actors, companies", () => {
    test("director filter shows only films by selected director", async ({
      page,
    }) => {
      await loginAsExhibitor(page);
      await page.goto("/en/catalog");

      // Wait for the catalog page to load with films
      await expect(page.getByText("The Third Man")).toBeVisible({
        timeout: 15000,
      });

      // Open filter dialog
      await page.getByRole("button", { name: "Filters" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Open director filter (button shows placeholder text)
      const directorBtn = dialog.getByRole("combobox").filter({ hasText: "Select directors" });
      await directorBtn.click();

      // Select "Carol Reed"
      await page.getByRole("option", { name: "Carol Reed" }).click();
      // Close popover
      await page.keyboard.press("Escape");

      // Close filter dialog
      await dialog.getByRole("button", { name: /show/i }).click();

      // Wait for results to update — The Third Man should be visible, Citizen Kane should not
      await expect(page.getByText("The Third Man")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("Citizen Kane")).not.toBeVisible();
    });

    test("actor filter shows films with selected actor", async ({ page }) => {
      await loginAsExhibitor(page);
      await page.goto("/en/catalog");

      // Wait for page to load
      await expect(page.getByText("The Third Man")).toBeVisible({
        timeout: 15000,
      });

      // Open filter dialog
      await page.getByRole("button", { name: "Filters" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Open actor filter
      const actorBtn = dialog.getByRole("combobox").filter({ hasText: "Select actors" });
      await actorBtn.click();

      // Select "Joseph Cotten" — both films have him
      await page.getByRole("option", { name: "Joseph Cotten" }).click();
      // Close popover
      await page.keyboard.press("Escape");

      // Close filter dialog
      await dialog.getByRole("button", { name: /show/i }).click();

      // Both films should be visible
      await expect(page.getByText("The Third Man")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("Citizen Kane")).toBeVisible();
    });

    test("company filter shows only films from selected company", async ({
      page,
    }) => {
      await loginAsExhibitor(page);
      await page.goto("/en/catalog");

      // Wait for page to load
      await expect(page.getByText("The Third Man")).toBeVisible({
        timeout: 15000,
      });

      // Open filter dialog
      await page.getByRole("button", { name: "Filters" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Open company filter
      const companyBtn = dialog.getByRole("combobox").filter({ hasText: "Select companies" });
      await companyBtn.click();

      // Select "RKO Radio Pictures" — only Citizen Kane
      await page
        .getByRole("option", { name: "RKO Radio Pictures" })
        .click();
      // Close popover
      await page.keyboard.press("Escape");

      // Close filter dialog
      await dialog.getByRole("button", { name: /show/i }).click();

      await expect(page.getByText("Citizen Kane")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("The Third Man")).not.toBeVisible();
    });

    test("combined director + actor filter narrows results", async ({
      page,
    }) => {
      await loginAsExhibitor(page);
      await page.goto("/en/catalog");

      // Wait for page to load
      await expect(page.getByText("The Third Man")).toBeVisible({
        timeout: 15000,
      });

      // Open filter dialog
      await page.getByRole("button", { name: "Filters" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();

      // Filter by director "Orson Welles"
      const directorBtn = dialog.getByRole("combobox").filter({ hasText: "Select directors" });
      await directorBtn.click();
      await page.getByRole("option", { name: "Orson Welles" }).click();
      // Close popover by pressing Escape
      await page.keyboard.press("Escape");

      // Also filter by actor "Orson Welles"
      const actorBtn = dialog.getByRole("combobox").filter({ hasText: "Select actors" });
      await actorBtn.click();
      await page.getByRole("option", { name: "Orson Welles" }).click();
      // Close popover
      await page.keyboard.press("Escape");

      // Close filter dialog
      await dialog.getByRole("button", { name: /show/i }).click();

      // Only Citizen Kane — directed by AND starring Orson Welles
      await expect(page.getByText("Citizen Kane")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("The Third Man")).not.toBeVisible();
    });
  });
});
