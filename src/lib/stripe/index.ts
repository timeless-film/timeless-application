import Stripe from "stripe";

import { validateVatFormat } from "@/lib/services/vat-service";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

/**
 * Creates a Stripe Checkout Session for the exhibitor's cart.
 * Uses hosted Checkout with automatic_tax enabled.
 * Session expires after 30 minutes to force fresh exchange rates.
 */
export async function createStripeCheckoutSession(params: {
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  customerId: string;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  const { lineItems, customerId, currency, successUrl, cancelUrl, metadata } = params;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    customer: customerId,
    currency: currency.toLowerCase(),
    automatic_tax: { enabled: true },
    invoice_creation: { enabled: true },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    payment_intent_data: {
      metadata,
    },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
  });

  return session;
}

/**
 * Transfers the rights holder's amount after a successful payment.
 * Uses the Charge ID (not PaymentIntent ID) as source_transaction.
 */
export async function transferToRightsHolder(params: {
  amount: number;
  currency: string;
  stripeConnectAccountId: string;
  chargeId: string;
  orderItemId: string;
}) {
  return stripe.transfers.create({
    amount: params.amount,
    currency: params.currency.toLowerCase(),
    destination: params.stripeConnectAccountId,
    source_transaction: params.chargeId,
    metadata: {
      order_item_id: params.orderItemId,
    },
  });
}

/**
 * Gets an existing Stripe Customer or creates/updates one for an account.
 * Updates address and tax_id so Stripe Tax can calculate correctly.
 */
export async function getOrUpdateStripeCustomer(params: {
  stripeCustomerId?: string | null;
  email: string;
  name: string;
  vatNumber?: string | null;
  phone?: string | null;
  address?: {
    line1?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
  metadata?: {
    timeless_account_id: string;
    account_type: string;
  };
}): Promise<Stripe.Customer> {
  const { stripeCustomerId, email, name, vatNumber, phone, address, metadata } = params;

  // Only use VAT number if it passes format validation (must have country prefix like FR12345678901)
  const validVat = vatNumber && validateVatFormat(vatNumber).valid ? vatNumber : null;

  if (stripeCustomerId) {
    // Update existing customer with latest info
    const customer = await stripe.customers.update(stripeCustomerId, {
      email,
      name,
      phone: phone || undefined,
      address: address || undefined,
      metadata: metadata || undefined,
    });

    // Sync tax_id: remove stale ones, add current if missing (best-effort)
    try {
      const existingTaxIds = await stripe.customers.listTaxIds(stripeCustomerId, { limit: 10 });
      if (validVat) {
        // Remove any tax_id that doesn't match the current VAT number
        for (const taxId of existingTaxIds.data) {
          if (taxId.type === "eu_vat" && taxId.value !== validVat) {
            await stripe.customers.deleteTaxId(stripeCustomerId, taxId.id);
          }
        }
        // Add current VAT if not already present
        const hasVat = existingTaxIds.data.some((t) => t.value === validVat);
        if (!hasVat) {
          await stripe.customers.createTaxId(stripeCustomerId, {
            type: "eu_vat",
            value: validVat,
          });
        }
      } else {
        // No valid VAT number — remove all eu_vat tax IDs
        for (const taxId of existingTaxIds.data) {
          if (taxId.type === "eu_vat") {
            await stripe.customers.deleteTaxId(stripeCustomerId, taxId.id);
          }
        }
      }
    } catch (error) {
      console.error("Failed to sync tax_id on Stripe customer (non-blocking):", error);
    }

    return customer;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    name,
    phone: phone || undefined,
    tax_id_data: validVat ? [{ type: "eu_vat", value: validVat }] : undefined,
    address: address || undefined,
    metadata: metadata || undefined,
  });

  return customer;
}

/**
 * Creates a Stripe Connect onboarding link for a rights holder.
 */
export async function createConnectOnboardingLink(params: {
  accountId?: string; // If already created
  email: string;
  returnUrl: string;
  refreshUrl: string;
}) {
  let account;
  if (params.accountId) {
    account = { id: params.accountId };
  } else {
    account = await stripe.accounts.create({
      type: "express",
      email: params.email,
      capabilities: {
        transfers: { requested: true },
      },
    });
  }

  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: "account_onboarding",
  });

  return { accountId: account.id, url: link.url };
}
