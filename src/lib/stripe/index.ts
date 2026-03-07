import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

/**
 * Creates a PaymentIntent for an exhibitor's cart.
 * Handles automatic split to rights holders via Stripe Connect.
 */
export async function createCartPaymentIntent(params: {
  items: {
    displayedPrice: number; // In cents
    rightsHolderAmount: number; // In cents
    stripeConnectAccountId: string;
    currency: string;
  }[];
  exhibitorStripeCustomerId: string;
  totalAmount: number;
  currency: string;
  metadata: Record<string, string>;
}) {
  const { totalAmount, currency, exhibitorStripeCustomerId, metadata } = params;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalAmount,
    currency: currency.toLowerCase(),
    customer: exhibitorStripeCustomerId,
    automatic_payment_methods: { enabled: true },
    metadata,
  });

  return paymentIntent;
}

/**
 * Transfers the rights holder's amount after a successful payment.
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
 * Gets or creates a Stripe Customer for an account.
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
    tax_id_data: params.vatNumber ? [{ type: "eu_vat", value: params.vatNumber }] : undefined,
    address: params.address,
  });
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
