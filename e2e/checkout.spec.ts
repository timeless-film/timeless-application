/**
 * E2E tests for the full Checkout & Payment flow (E08-009).
 *
 * Tests the complete payment pipeline:
 * - Cart checkout → UI validation + Stripe redirect (with real keys)
 * - Webhook processing → order creation (simulated webhooks)
 * - Request payment → webhook → order + request status transition
 * - Multi-currency checkout
 * - Webhook idempotency
 *
 * Uses simulated webhook events (signed with STRIPE_WEBHOOK_SECRET) to test
 * the full flow without requiring real Stripe Checkout interactions.
 * When a real Stripe test key is available (sk_test_*), additional tests
 * validate the Stripe Checkout Session creation.
 */
import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import postgres from "postgres";

import { setupExhibitor } from "./helpers/exhibitor";
import {
  buildCartCheckoutEvent,
  buildRequestCheckoutEvent,
  buildCheckoutExpiredEvent,
  hasRealStripeKey,
  sendWebhookEvent,
} from "./helpers/stripe";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://timeless:timeless@localhost:5432/timeless_test";

const TEST_ID = Date.now().toString(36);

function uniqueSuffix() {
  return `${TEST_ID}-${randomBytes(4).toString("hex")}`;
}

// ─── Cart checkout — UI tests ─────────────────────────────────────────────────

test.describe("Checkout — cart empty state", () => {
  test("checkout button is absent when cart is empty", async ({
    page,
    request,
  }) => {
    await setupExhibitor(page, request, "checkout-empty");

    await page.goto("/en/cart");
    await expect(page).toHaveURL(/\/en\/cart/);

    await expect(page.getByRole("heading", { name: /cart/i })).toBeVisible({
      timeout: 15000,
    });

    await expect(
      page.getByRole("button", { name: /proceed to payment/i })
    ).not.toBeVisible();
  });
});

test.describe("Checkout — cart with items", () => {
  let sql: ReturnType<typeof postgres>;

  test.beforeAll(async () => {
    sql = postgres(DATABASE_URL, { max: 1 });
  });

  test.afterAll(async () => {
    await sql.end();
  });

  test("cart page shows items and checkout button", async ({
    page,
    request,
  }) => {
    const { companyName } = await setupExhibitor(
      page,
      request,
      "checkout-items"
    );

    const [account] = await sql`
      SELECT id FROM accounts WHERE company_name = ${companyName}
    `;
    const exhibitorAccountId = account!.id;

    const [cinema] = await sql`
      SELECT id, country FROM cinemas WHERE account_id = ${exhibitorAccountId} LIMIT 1
    `;
    const [room] = await sql`
      SELECT id FROM rooms WHERE cinema_id = ${cinema!.id} LIMIT 1
    `;

    const suffix = uniqueSuffix();
    const [rh] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, stripe_connect_account_id, stripe_connect_onboarding_complete)
      VALUES ('rights_holder', ${"RH Checkout " + suffix}, 'FR', true, ${"acct_test_" + suffix}, true)
      RETURNING id
    `;

    const filmTitle = `Checkout Film ${suffix}`;
    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rh!.id}, ${filmTitle}, 'direct', 'active', 1970)
      RETURNING id
    `;

    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${film!.id}, ARRAY[${cinema!.country}], 15000, 'EUR')
    `;

    await sql`
      INSERT INTO cart_items (exhibitor_account_id, film_id, cinema_id, room_id, screening_count)
      VALUES (${exhibitorAccountId}, ${film!.id}, ${cinema!.id}, ${room!.id}, 2)
    `;

    await page.goto("/en/cart");
    await expect(page).toHaveURL(/\/en\/cart/);
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole("button", { name: /proceed to payment/i })
    ).toBeVisible();
  });

  test("checkout shows error when RH is not Stripe onboarded", async ({
    page,
    request,
  }) => {
    const { companyName } = await setupExhibitor(
      page,
      request,
      "checkout-noonboard"
    );

    const [account] = await sql`
      SELECT id FROM accounts WHERE company_name = ${companyName}
    `;
    const accountId = account!.id;

    const [cinema] = await sql`
      SELECT id, country FROM cinemas WHERE account_id = ${accountId} LIMIT 1
    `;
    const [room] = await sql`
      SELECT id FROM rooms WHERE cinema_id = ${cinema!.id} LIMIT 1
    `;

    const suffix = uniqueSuffix();
    const [rh] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, stripe_connect_onboarding_complete)
      VALUES ('rights_holder', ${"RH NotOnboarded " + suffix}, 'FR', true, false)
      RETURNING id
    `;

    const filmTitle = `Not Onboarded Film ${suffix}`;
    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rh!.id}, ${filmTitle}, 'direct', 'active', 1980)
      RETURNING id
    `;

    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${film!.id}, ARRAY[${cinema!.country}], 10000, 'EUR')
    `;

    await sql`
      INSERT INTO cart_items (exhibitor_account_id, film_id, cinema_id, room_id, screening_count)
      VALUES (${accountId}, ${film!.id}, ${cinema!.id}, ${room!.id}, 1)
    `;

    await page.goto("/en/cart");
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: /proceed to payment/i }).click();

    await expect(
      page.locator("[data-sonner-toast]").first()
    ).toBeVisible({ timeout: 10000 });
  });
});

// ─── Checkout — Stripe redirect (requires real Stripe test key) ──────────────

test.describe("Checkout — Stripe Checkout redirect", () => {
  // These tests require a real Stripe test key to create actual Checkout Sessions
  test.skip(!hasRealStripeKey(), "Requires real STRIPE_SECRET_KEY (sk_test_*)");

  let sql: ReturnType<typeof postgres>;

  test.beforeAll(async () => {
    sql = postgres(DATABASE_URL, { max: 1 });
  });

  test.afterAll(async () => {
    await sql.end();
  });

  test("checkout redirects to Stripe Checkout page", async ({
    page,
    request,
  }) => {
    const { companyName } = await setupExhibitor(
      page,
      request,
      "checkout-stripe"
    );

    const [account] = await sql`
      SELECT id FROM accounts WHERE company_name = ${companyName}
    `;
    const exhibitorAccountId = account!.id;

    const [cinema] = await sql`
      SELECT id, country FROM cinemas WHERE account_id = ${exhibitorAccountId} LIMIT 1
    `;
    const [room] = await sql`
      SELECT id FROM rooms WHERE cinema_id = ${cinema!.id} LIMIT 1
    `;

    const suffix = uniqueSuffix();
    const [rh] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, stripe_connect_account_id, stripe_connect_onboarding_complete)
      VALUES ('rights_holder', ${"RH Stripe " + suffix}, 'FR', true, ${"acct_test_stripe_" + suffix}, true)
      RETURNING id
    `;

    const filmTitle = `Stripe Film ${suffix}`;
    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rh!.id}, ${filmTitle}, 'direct', 'active', 1965)
      RETURNING id
    `;

    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${film!.id}, ARRAY[${cinema!.country}], 15000, 'EUR')
    `;

    await sql`
      INSERT INTO cart_items (exhibitor_account_id, film_id, cinema_id, room_id, screening_count)
      VALUES (${exhibitorAccountId}, ${film!.id}, ${cinema!.id}, ${room!.id}, 1)
    `;

    await page.goto("/en/cart");
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 15000 });

    // Click checkout and verify redirect to Stripe
    await page.getByRole("button", { name: /proceed to payment/i }).click();
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });
    expect(page.url()).toContain("checkout.stripe.com");
  });
});

// ─── Webhook — cart payment creates order ────────────────────────────────────

test.describe("Webhook — cart payment flow", () => {
  let sql: ReturnType<typeof postgres>;

  test.beforeAll(async () => {
    sql = postgres(DATABASE_URL, { max: 1 });
  });

  test.afterAll(async () => {
    await sql.end();
  });

  test("checkout.session.completed creates order and clears cart", async ({
    request,
  }) => {
    const suffix = uniqueSuffix();

    // Create exhibitor account
    const [exhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, preferred_currency)
      VALUES ('exhibitor', ${"Exhibitor WH " + suffix}, 'FR', true, 'EUR')
      RETURNING id
    `;
    const exhibitorAccountId = exhibitor!.id;

    // Create RH with Stripe Connect
    const [rh] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, stripe_connect_account_id, stripe_connect_onboarding_complete)
      VALUES ('rights_holder', ${"RH WH " + suffix}, 'FR', true, ${"acct_wh_" + suffix}, true)
      RETURNING id
    `;

    // Create cinema & room
    const [cinema] = await sql`
      INSERT INTO cinemas (account_id, name, address, city, postal_code, country)
      VALUES (${exhibitorAccountId}, ${"Cinema WH " + suffix}, '1 Rue Test', 'Paris', '75001', 'FR')
      RETURNING id
    `;
    const [room] = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinema!.id}, 'Salle 1', 200)
      RETURNING id
    `;

    // Create film with price
    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rh!.id}, ${"WH Film " + suffix}, 'direct', 'active', 1960)
      RETURNING id
    `;
    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${film!.id}, ARRAY['FR'], 15000, 'EUR')
    `;

    // Add to cart
    const [cartItem] = await sql`
      INSERT INTO cart_items (exhibitor_account_id, film_id, cinema_id, room_id, screening_count)
      VALUES (${exhibitorAccountId}, ${film!.id}, ${cinema!.id}, ${room!.id}, 2)
      RETURNING id
    `;

    // Simulate checkout.session.completed webhook
    const event = buildCartCheckoutEvent({
      exhibitorAccountId,
      cartItemIds: [cartItem!.id],
      currency: "EUR",
      amountTotal: 41000, // 18000 (displayedPrice) × 2 screenings + 5000 delivery
      taxAmount: 0,
    });

    const { status } = await sendWebhookEvent(request, event);
    expect(status).toBe(200);

    // Verify order was created
    const orderRows = await sql`
      SELECT id, status, currency, exhibitor_account_id
      FROM orders
      WHERE exhibitor_account_id = ${exhibitorAccountId}
      ORDER BY created_at DESC LIMIT 1
    `;
    expect(orderRows.length).toBe(1);
    expect(orderRows[0]!.status).toBe("paid");
    expect(orderRows[0]!.currency).toBe("EUR");

    // Verify order items
    const itemRows = await sql`
      SELECT film_id, cinema_id, room_id, screening_count, currency
      FROM order_items
      WHERE order_id = ${orderRows[0]!.id}
    `;
    expect(itemRows.length).toBe(1);
    expect(itemRows[0]!.film_id).toBe(film!.id);
    expect(itemRows[0]!.screening_count).toBe(2);

    // Verify cart was cleared
    const cartRows = await sql`
      SELECT id FROM cart_items WHERE exhibitor_account_id = ${exhibitorAccountId}
    `;
    expect(cartRows.length).toBe(0);
  });

  test("webhook is idempotent — duplicate event does not create second order", async ({
    request,
  }) => {
    const suffix = uniqueSuffix();

    const [exhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, preferred_currency)
      VALUES ('exhibitor', ${"Exhibitor Idemp " + suffix}, 'FR', true, 'EUR')
      RETURNING id
    `;
    const exhibitorAccountId = exhibitor!.id;

    const [rh] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, stripe_connect_account_id, stripe_connect_onboarding_complete)
      VALUES ('rights_holder', ${"RH Idemp " + suffix}, 'FR', true, ${"acct_idemp_" + suffix}, true)
      RETURNING id
    `;

    const [cinema] = await sql`
      INSERT INTO cinemas (account_id, name, address, city, postal_code, country)
      VALUES (${exhibitorAccountId}, ${"Cinema Idemp " + suffix}, '1 Rue Test', 'Paris', '75001', 'FR')
      RETURNING id
    `;
    const [room] = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinema!.id}, 'Salle 1', 150)
      RETURNING id
    `;

    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rh!.id}, ${"Idemp Film " + suffix}, 'direct', 'active', 1950)
      RETURNING id
    `;
    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${film!.id}, ARRAY['FR'], 10000, 'EUR')
    `;

    const [cartItem] = await sql`
      INSERT INTO cart_items (exhibitor_account_id, film_id, cinema_id, room_id, screening_count)
      VALUES (${exhibitorAccountId}, ${film!.id}, ${cinema!.id}, ${room!.id}, 1)
      RETURNING id
    `;

    // Send the same event twice (same paymentIntentId)
    const paymentIntentId = `pi_idemp_${suffix}`;
    const event = buildCartCheckoutEvent({
      exhibitorAccountId,
      cartItemIds: [cartItem!.id],
      currency: "EUR",
      amountTotal: 17000,
      paymentIntentId,
    });

    const result1 = await sendWebhookEvent(request, event);
    expect(result1.status).toBe(200);

    // Second call with same PI — should be ignored by idempotency check
    const result2 = await sendWebhookEvent(request, event);
    expect(result2.status).toBe(200);

    // Should have exactly one order
    const orderRows = await sql`
      SELECT id FROM orders WHERE exhibitor_account_id = ${exhibitorAccountId}
    `;
    expect(orderRows.length).toBe(1);
  });

  test("checkout.session.expired is handled gracefully", async ({
    request,
  }) => {
    const suffix = uniqueSuffix();

    const event = buildCheckoutExpiredEvent({
      exhibitorAccountId: `00000000-0000-0000-0000-${suffix.padEnd(12, "0").slice(0, 12)}`,
    });

    const { status } = await sendWebhookEvent(request, event);
    expect(status).toBe(200);
  });

  test("webhook rejects invalid signature", async ({ request }) => {
    const event = buildCartCheckoutEvent({
      exhibitorAccountId: "00000000-0000-0000-0000-000000000001",
      cartItemIds: [],
      currency: "EUR",
      amountTotal: 0,
    });

    const payload = JSON.stringify(event);
    const response = await request.post("/api/webhooks/stripe", {
      data: payload,
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": "t=0,v1=invalid_signature",
      },
    });

    expect(response.status()).toBe(400);
  });
});

// ─── Webhook — request payment flow ──────────────────────────────────────────

test.describe("Webhook — request payment flow", () => {
  let sql: ReturnType<typeof postgres>;

  test.beforeAll(async () => {
    sql = postgres(DATABASE_URL, { max: 1 });
  });

  test.afterAll(async () => {
    await sql.end();
  });

  test("checkout.session.completed for request creates order and transitions status", async ({
    request,
  }) => {
    const suffix = uniqueSuffix();

    // Create exhibitor
    const [exhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, preferred_currency)
      VALUES ('exhibitor', ${"Exhibitor ReqPay " + suffix}, 'FR', true, 'EUR')
      RETURNING id
    `;
    const exhibitorAccountId = exhibitor!.id;

    // Create RH with Stripe Connect
    const [rh] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, stripe_connect_account_id, stripe_connect_onboarding_complete)
      VALUES ('rights_holder', ${"RH ReqPay " + suffix}, 'FR', true, ${"acct_reqpay_" + suffix}, true)
      RETURNING id
    `;

    // Create cinema & room
    const [cinema] = await sql`
      INSERT INTO cinemas (account_id, name, address, city, postal_code, country)
      VALUES (${exhibitorAccountId}, ${"Cinema ReqPay " + suffix}, '1 Rue Test', 'Paris', '75001', 'FR')
      RETURNING id
    `;
    const [room] = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinema!.id}, 'Salle ReqPay', 100)
      RETURNING id
    `;

    // Create film
    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rh!.id}, ${"ReqPay Film " + suffix}, 'validation', 'active', 1972)
      RETURNING id
    `;
    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${film!.id}, ARRAY['FR'], 20000, 'EUR')
    `;

    // Create an approved request (simulates E07 workflow completion)
    const [req] = await sql`
      INSERT INTO requests (
        exhibitor_account_id, rights_holder_account_id, film_id, cinema_id, room_id,
        screening_count, catalog_price, currency, platform_margin_rate, delivery_fees,
        commission_rate, displayed_price, rights_holder_amount, timeless_amount,
        status, approved_at
      ) VALUES (
        ${exhibitorAccountId}, ${rh!.id}, ${film!.id}, ${cinema!.id}, ${room!.id},
        3, 20000, 'EUR', '0.20', 5000,
        '0.10', 24000, 18000, 6000,
        'approved', NOW()
      )
      RETURNING id
    `;

    // Simulate checkout.session.completed for request
    const event = buildRequestCheckoutEvent({
      exhibitorAccountId,
      requestId: req!.id,
      rightsHolderAccountId: rh!.id,
      currency: "EUR",
      amountTotal: 77000,
    });

    const { status } = await sendWebhookEvent(request, event);
    expect(status).toBe(200);

    // Verify order was created
    const orderRows = await sql`
      SELECT id, status, currency FROM orders
      WHERE exhibitor_account_id = ${exhibitorAccountId}
      ORDER BY created_at DESC LIMIT 1
    `;
    expect(orderRows.length).toBe(1);
    expect(orderRows[0]!.status).toBe("paid");

    // Verify request status transitioned to 'paid'
    const [updatedReq] = await sql`
      SELECT status, paid_at FROM requests WHERE id = ${req!.id}
    `;
    expect(updatedReq!.status).toBe("paid");
    expect(updatedReq!.paid_at).not.toBeNull();

    // Verify order item linked to request
    const itemRows = await sql`
      SELECT request_id, film_id, screening_count FROM order_items
      WHERE order_id = ${orderRows[0]!.id}
    `;
    expect(itemRows.length).toBe(1);
    expect(itemRows[0]!.request_id).toBe(req!.id);
    expect(itemRows[0]!.screening_count).toBe(3);
  });

  test("webhook ignores non-approved request", async ({ request }) => {
    const suffix = uniqueSuffix();

    const [exhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('exhibitor', ${"Exhibitor ReqPending " + suffix}, 'FR', true)
      RETURNING id
    `;
    const [rh] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, stripe_connect_account_id, stripe_connect_onboarding_complete)
      VALUES ('rights_holder', ${"RH ReqPending " + suffix}, 'FR', true, ${"acct_pending_" + suffix}, true)
      RETURNING id
    `;
    const [cinema] = await sql`
      INSERT INTO cinemas (account_id, name, address, city, postal_code, country)
      VALUES (${exhibitor!.id}, ${"Cinema Pending " + suffix}, '1 Rue', 'Paris', '75001', 'FR')
      RETURNING id
    `;
    const [room] = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinema!.id}, 'Salle', 100)
      RETURNING id
    `;
    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rh!.id}, ${"Pending Film " + suffix}, 'validation', 'active', 1975)
      RETURNING id
    `;
    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${film!.id}, ARRAY['FR'], 10000, 'EUR')
    `;

    // Create a PENDING request (not approved)
    const [req] = await sql`
      INSERT INTO requests (
        exhibitor_account_id, rights_holder_account_id, film_id, cinema_id, room_id,
        screening_count, catalog_price, currency, platform_margin_rate, delivery_fees,
        commission_rate, displayed_price, rights_holder_amount, timeless_amount,
        status
      ) VALUES (
        ${exhibitor!.id}, ${rh!.id}, ${film!.id}, ${cinema!.id}, ${room!.id},
        1, 10000, 'EUR', '0.20', 5000,
        '0.10', 12000, 9000, 3000,
        'pending'
      )
      RETURNING id
    `;

    const event = buildRequestCheckoutEvent({
      exhibitorAccountId: exhibitor!.id,
      requestId: req!.id,
      rightsHolderAccountId: rh!.id,
      currency: "EUR",
      amountTotal: 17000,
    });

    const { status } = await sendWebhookEvent(request, event);
    // Webhook returns 200 (accepted) but doesn't create order (request not approved)
    expect(status).toBe(200);

    // No order should be created
    const orderRows = await sql`
      SELECT id FROM orders WHERE exhibitor_account_id = ${exhibitor!.id}
    `;
    expect(orderRows.length).toBe(0);

    // Request status unchanged
    const [reqCheck] = await sql`
      SELECT status FROM requests WHERE id = ${req!.id}
    `;
    expect(reqCheck!.status).toBe("pending");
  });
});

// ─── Webhook — multi-currency cart ───────────────────────────────────────────

test.describe("Webhook — multi-currency checkout", () => {
  let sql: ReturnType<typeof postgres>;

  test.beforeAll(async () => {
    sql = postgres(DATABASE_URL, { max: 1 });
  });

  test.afterAll(async () => {
    await sql.end();
  });

  test("cart with mixed currencies creates order in exhibitor currency", async ({
    request,
  }) => {
    const suffix = uniqueSuffix();

    // EUR exhibitor
    const [exhibitor] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, preferred_currency)
      VALUES ('exhibitor', ${"Exhibitor Multi " + suffix}, 'FR', true, 'EUR')
      RETURNING id
    `;
    const exhibitorAccountId = exhibitor!.id;

    // Create 2 RHs — one EUR, one USD
    const [rhEur] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, stripe_connect_account_id, stripe_connect_onboarding_complete)
      VALUES ('rights_holder', ${"RH EUR " + suffix}, 'FR', true, ${"acct_eur_" + suffix}, true)
      RETURNING id
    `;
    const [rhUsd] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed, stripe_connect_account_id, stripe_connect_onboarding_complete)
      VALUES ('rights_holder', ${"RH USD " + suffix}, 'US', true, ${"acct_usd_" + suffix}, true)
      RETURNING id
    `;

    const [cinema] = await sql`
      INSERT INTO cinemas (account_id, name, address, city, postal_code, country)
      VALUES (${exhibitorAccountId}, ${"Cinema Multi " + suffix}, '1 Rue Test', 'Paris', '75001', 'FR')
      RETURNING id
    `;
    const [room] = await sql`
      INSERT INTO rooms (cinema_id, name, capacity)
      VALUES (${cinema!.id}, 'Salle Multi', 200)
      RETURNING id
    `;

    // EUR film
    const [filmEur] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rhEur!.id}, ${"EUR Film " + suffix}, 'direct', 'active', 1955)
      RETURNING id
    `;
    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${filmEur!.id}, ARRAY['FR'], 15000, 'EUR')
    `;

    // USD film
    const [filmUsd] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rhUsd!.id}, ${"USD Film " + suffix}, 'direct', 'active', 1960)
      RETURNING id
    `;
    await sql`
      INSERT INTO film_prices (film_id, countries, price, currency)
      VALUES (${filmUsd!.id}, ARRAY['FR'], 20000, 'USD')
    `;

    // Add both to cart
    const [cartItem1] = await sql`
      INSERT INTO cart_items (exhibitor_account_id, film_id, cinema_id, room_id, screening_count)
      VALUES (${exhibitorAccountId}, ${filmEur!.id}, ${cinema!.id}, ${room!.id}, 1)
      RETURNING id
    `;
    const [cartItem2] = await sql`
      INSERT INTO cart_items (exhibitor_account_id, film_id, cinema_id, room_id, screening_count)
      VALUES (${exhibitorAccountId}, ${filmUsd!.id}, ${cinema!.id}, ${room!.id}, 1)
      RETURNING id
    `;

    const event = buildCartCheckoutEvent({
      exhibitorAccountId,
      cartItemIds: [cartItem1!.id, cartItem2!.id],
      currency: "EUR",
      amountTotal: 46000,
    });

    const { status } = await sendWebhookEvent(request, event);
    expect(status).toBe(200);

    // Verify order is in EUR (exhibitor's currency)
    const orderRows = await sql`
      SELECT id, currency FROM orders
      WHERE exhibitor_account_id = ${exhibitorAccountId}
      ORDER BY created_at DESC LIMIT 1
    `;
    expect(orderRows.length).toBe(1);
    expect(orderRows[0]!.currency).toBe("EUR");

    // Verify both items exist
    const itemRows = await sql`
      SELECT film_id, currency, original_currency FROM order_items
      WHERE order_id = ${orderRows[0]!.id}
      ORDER BY created_at
    `;
    expect(itemRows.length).toBe(2);

    // EUR film has no conversion
    const eurItem = itemRows.find((r: Record<string, unknown>) => r.film_id === filmEur!.id);
    expect(eurItem!.currency).toBe("EUR");
    expect(eurItem!.original_currency).toBeNull();

    // USD film was converted — original currency should be USD
    const usdItem = itemRows.find((r: Record<string, unknown>) => r.film_id === filmUsd!.id);
    expect(usdItem!.currency).toBe("EUR");
    expect(usdItem!.original_currency).toBe("USD");

    // Cart should be cleared
    const cartRows = await sql`
      SELECT id FROM cart_items WHERE exhibitor_account_id = ${exhibitorAccountId}
    `;
    expect(cartRows.length).toBe(0);
  });
});

// ─── Orders page — after payment (UI) ───────────────────────────────────────

test.describe("Orders page — post-payment", () => {
  let sql: ReturnType<typeof postgres>;

  test.beforeAll(async () => {
    sql = postgres(DATABASE_URL, { max: 1 });
  });

  test.afterAll(async () => {
    await sql.end();
  });

  test("success return from Stripe shows order in list", async ({
    page,
    request,
  }) => {
    const { companyName } = await setupExhibitor(page, request, "orders-stripe");

    const [account] = await sql`
      SELECT id FROM accounts WHERE company_name = ${companyName}
    `;
    const exhibitorAccountId = account!.id;

    // Seed a paid order
    const suffix = uniqueSuffix();
    const [rh] = await sql`
      INSERT INTO accounts (type, company_name, country, onboarding_completed)
      VALUES ('rights_holder', ${"RH Orders Stripe " + suffix}, 'FR', true)
      RETURNING id
    `;

    const filmTitle = `Paid Film ${suffix}`;
    const [film] = await sql`
      INSERT INTO films (account_id, title, type, status, release_year)
      VALUES (${rh!.id}, ${filmTitle}, 'direct', 'active', 1968)
      RETURNING id
    `;

    const [cinema] = await sql`
      SELECT id FROM cinemas WHERE account_id = ${exhibitorAccountId} LIMIT 1
    `;
    const [room] = await sql`
      SELECT id FROM rooms WHERE cinema_id = ${cinema!.id} LIMIT 1
    `;

    const [order] = await sql`
      INSERT INTO orders (exhibitor_account_id, status, stripe_payment_intent_id, subtotal, delivery_fees_total, tax_amount, total, currency, paid_at)
      VALUES (${exhibitorAccountId}, 'paid', ${"pi_success_" + suffix}, 18000, 5000, 0, 23000, 'EUR', NOW())
      RETURNING id, order_number
    `;

    await sql`
      INSERT INTO order_items (order_id, film_id, cinema_id, room_id, rights_holder_account_id, screening_count, catalog_price, platform_margin_rate, delivery_fees, commission_rate, displayed_price, rights_holder_amount, timeless_amount, currency)
      VALUES (${order!.id}, ${film!.id}, ${cinema!.id}, ${room!.id}, ${rh!.id}, 1, 15000, '0.20', 5000, '0.10', 18000, 13500, 4500, 'EUR')
    `;

    // Navigate to orders with session_id (simulates return from Stripe)
    await page.goto(`/en/orders?session_id=cs_test_${suffix}`);
    await expect(page).toHaveURL(/\/en\/orders/);
    await expect(
      page.getByRole("heading", { name: /order history/i })
    ).toBeVisible({ timeout: 15000 });

    // Verify the order appears
    const orderRef = `ORD-${String(order!.order_number).padStart(6, "0")}`;
    await expect(page.getByText(orderRef)).toBeVisible({ timeout: 10000 });

    // Click to see detail
    const orderRow = page.getByRole("row").filter({ hasText: orderRef });
    const detailLink = orderRow.getByRole("link");
    await detailLink.click();

    // Verify detail page
    await expect(page).toHaveURL(new RegExp(`/en/orders/${order!.id}`));
    await expect(page.getByText(filmTitle)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Paid", { exact: true })).toBeVisible();
  });
});
