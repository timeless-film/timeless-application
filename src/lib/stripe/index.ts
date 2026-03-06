import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

/**
 * Crée un PaymentIntent pour le panier d'un exploitant.
 * Gère le split automatique vers les ayants droits (Stripe Connect).
 */
export async function createCartPaymentIntent(params: {
  items: {
    displayedPrice: number;   // En centimes
    ayantDroitAmount: number; // En centimes
    stripeConnectAccountId: string;
    currency: string;
  }[];
  exploitantStripeCustomerId: string;
  totalAmount: number;
  currency: string;
  metadata: Record<string, string>;
}) {
  const { totalAmount, currency, exploitantStripeCustomerId, metadata } = params;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalAmount,
    currency: currency.toLowerCase(),
    customer: exploitantStripeCustomerId,
    automatic_payment_methods: { enabled: true },
    metadata,
  });

  return paymentIntent;
}

/**
 * Transfère le montant de l'ayant droit après paiement réussi.
 */
export async function transferToRightsHolder(params: {
  amount: number;
  currency: string;
  stripeConnectAccountId: string;
  paymentIntentId: string;
  orderItemId: string;
}) {
  return stripe.transfers.create({
    amount: params.amount,
    currency: params.currency.toLowerCase(),
    destination: params.stripeConnectAccountId,
    source_transaction: params.paymentIntentId,
    metadata: {
      order_item_id: params.orderItemId,
    },
  });
}

/**
 * Crée ou récupère un Customer Stripe pour un compte.
 */
export async function getOrCreateStripeCustomer(params: {
  email: string;
  name: string;
  vatNumber?: string;
  address?: {
    line1?: string;
    city?: string;
    postal_code?: string;
    country?: string;
  };
}) {
  const existing = await stripe.customers.search({
    query: `email:'${params.email}'`,
    limit: 1,
  });

  if (existing.data.length > 0) return existing.data[0];

  return stripe.customers.create({
    email: params.email,
    name: params.name,
    tax_id_data: params.vatNumber
      ? [{ type: "eu_vat", value: params.vatNumber }]
      : undefined,
    address: params.address,
  });
}

/**
 * Crée un lien d'onboarding Stripe Connect pour un ayant droit.
 */
export async function createConnectOnboardingLink(params: {
  accountId?: string; // Si déjà créé
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
