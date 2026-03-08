/**
 * Pure logic for rights holder operations.
 * Extracted from webhook handlers and server actions for testability.
 */

/**
 * Determines if a Stripe Connect account has completed onboarding.
 * Both `details_submitted` and `charges_enabled` must be true.
 */
export function isStripeConnectComplete(account: {
  details_submitted: boolean;
  charges_enabled: boolean;
}): boolean {
  return account.details_submitted && account.charges_enabled;
}
