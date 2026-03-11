/**
 * Stripe E2E test helpers.
 *
 * Provides webhook simulation utilities for testing the full payment flow
 * without requiring a real Stripe Checkout interaction.
 *
 * Two modes:
 * - **Simulated webhooks** (always available): constructs & signs webhook events,
 *   POSTs them to the test server. Works with any webhook secret.
 * - **Real Stripe keys** (when STRIPE_SECRET_KEY starts with sk_test_):
 *   can create real Stripe Checkout Sessions for integration validation.
 */
import { createHmac, randomUUID } from "node:crypto";

import type { APIRequestContext } from "@playwright/test";

/**
 * The webhook secret used by the test server.
 * Must match the STRIPE_WEBHOOK_SECRET env var in playwright.config.ts.
 */
const TEST_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_e2e_secret";

// ─── Webhook signature ───────────────────────────────────────────────────────

/**
 * Generate a Stripe-compatible webhook signature header.
 * Uses the same HMAC-SHA256 scheme as Stripe: `t=timestamp,v1=signature`.
 */
export function generateWebhookSignature(
  payload: string,
  secret: string = TEST_WEBHOOK_SECRET,
): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

// ─── Event builders ──────────────────────────────────────────────────────────

/**
 * Build a checkout.session.completed event for a cart payment.
 */
export function buildCartCheckoutEvent(params: {
  exhibitorAccountId: string;
  cartItemIds: string[];
  currency: string;
  amountTotal: number;
  taxAmount?: number;
  paymentIntentId?: string;
  sessionId?: string;
  invoiceId?: string;
}): Record<string, unknown> {
  const {
    exhibitorAccountId,
    cartItemIds,
    currency,
    amountTotal,
    taxAmount = 0,
    paymentIntentId = `pi_test_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    sessionId = `cs_test_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    invoiceId = null,
  } = params;

  return {
    id: `evt_test_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        status: "complete",
        payment_intent: paymentIntentId,
        invoice: invoiceId,
        currency: currency.toLowerCase(),
        amount_total: amountTotal + taxAmount,
        amount_subtotal: amountTotal,
        total_details: {
          amount_discount: 0,
          amount_shipping: 0,
          amount_tax: taxAmount,
        },
        metadata: {
          exhibitor_account_id: exhibitorAccountId,
          cart_item_ids: JSON.stringify(cartItemIds),
        },
        customer: `cus_test_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        customer_details: {
          email: "test@e2e-test.local",
        },
      },
    },
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    api_version: "2026-02-25.clover",
  };
}

/**
 * Build a checkout.session.completed event for a request payment.
 */
export function buildRequestCheckoutEvent(params: {
  exhibitorAccountId: string;
  requestId: string;
  rightsHolderAccountId: string;
  currency: string;
  amountTotal: number;
  taxAmount?: number;
  paymentIntentId?: string;
  sessionId?: string;
  invoiceId?: string;
}): Record<string, unknown> {
  const {
    exhibitorAccountId,
    requestId,
    rightsHolderAccountId,
    currency,
    amountTotal,
    taxAmount = 0,
    paymentIntentId = `pi_test_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    sessionId = `cs_test_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    invoiceId = null,
  } = params;

  return {
    id: `evt_test_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        mode: "payment",
        payment_status: "paid",
        status: "complete",
        payment_intent: paymentIntentId,
        invoice: invoiceId,
        currency: currency.toLowerCase(),
        amount_total: amountTotal + taxAmount,
        amount_subtotal: amountTotal,
        total_details: {
          amount_discount: 0,
          amount_shipping: 0,
          amount_tax: taxAmount,
        },
        metadata: {
          exhibitor_account_id: exhibitorAccountId,
          request_id: requestId,
          rights_holder_account_id: rightsHolderAccountId,
        },
        customer: `cus_test_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        customer_details: {
          email: "test@e2e-test.local",
        },
      },
    },
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    api_version: "2026-02-25.clover",
  };
}

/**
 * Build a checkout.session.expired event.
 */
export function buildCheckoutExpiredEvent(params: {
  exhibitorAccountId: string;
  sessionId?: string;
}): Record<string, unknown> {
  const {
    exhibitorAccountId,
    sessionId = `cs_test_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
  } = params;

  return {
    id: `evt_test_${randomUUID().replace(/-/g, "").slice(0, 24)}`,
    object: "event",
    type: "checkout.session.expired",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        mode: "payment",
        payment_status: "unpaid",
        status: "expired",
        metadata: {
          exhibitor_account_id: exhibitorAccountId,
        },
      },
    },
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    api_version: "2026-02-25.clover",
  };
}

// ─── Webhook sender ──────────────────────────────────────────────────────────

/**
 * Sign and POST a simulated webhook event to the test server.
 * Returns the HTTP response for assertions.
 */
export async function sendWebhookEvent(
  request: APIRequestContext,
  event: Record<string, unknown>,
  webhookSecret: string = TEST_WEBHOOK_SECRET,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const payload = JSON.stringify(event);
  const signature = generateWebhookSignature(payload, webhookSecret);

  const response = await request.post("/api/webhooks/stripe", {
    data: payload,
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": signature,
    },
  });

  const body = await response.json().catch(() => ({}));
  return { status: response.status(), body: body as Record<string, unknown> };
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Check if a real Stripe test key is available.
 * Returns true when STRIPE_SECRET_KEY starts with "sk_test_" and is not a fake CI value.
 */
export function hasRealStripeKey(): boolean {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return key.startsWith("sk_test_") && !key.includes("fake");
}
