import { TrackClient, RegionUS } from "customerio-node";

const cio = new TrackClient(
  process.env.CUSTOMERIO_SITE_ID!,
  process.env.CUSTOMERIO_API_KEY!,
  { region: RegionUS }
);

// ─── Sync utilisateur ─────────────────────────────────────────────────────────

export async function identifyUser(params: {
  userId: string;
  email: string;
  name: string;
  accountType: "exploitant" | "ayant_droit" | "admin";
  accountId: string;
  country?: string;
}) {
  await cio.identify(params.userId, {
    email: params.email,
    name: params.name,
    account_type: params.accountType,
    account_id: params.accountId,
    country: params.country,
    created_at: Math.floor(Date.now() / 1000),
  });
}

// ─── Track events ─────────────────────────────────────────────────────────────

export async function trackEvent(
  userId: string,
  eventName: string,
  data?: Record<string, unknown>
) {
  await cio.track(userId, { name: eventName, data });
}

// ─── Events métier ────────────────────────────────────────────────────────────

export const CioEvents = {
  // Auth
  USER_INVITED: "user_invited",
  USER_ACTIVATED: "user_activated",

  // Catalogue
  FILM_ADDED: "film_added",
  FILM_IMPORTED: "film_imported",

  // Réservation
  CART_ITEM_ADDED: "cart_item_added",
  REQUEST_SUBMITTED: "request_submitted",
  REQUEST_VALIDATED: "request_validated",
  REQUEST_REFUSED: "request_refused",
  REQUEST_EXPIRED: "request_expired",

  // Paiement
  CHECKOUT_COMPLETED: "checkout_completed",
  PAYMENT_SUCCEEDED: "payment_succeeded",
  PAYMENT_FAILED: "payment_failed",

  // Livraison
  DELIVERY_CONFIRMED: "delivery_confirmed",

  // Finance
  WITHDRAWAL_INITIATED: "withdrawal_initiated",
  WITHDRAWAL_COMPLETED: "withdrawal_completed",
} as const;

export type CioEvent = (typeof CioEvents)[keyof typeof CioEvents];
