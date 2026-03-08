import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ACTIVE_ACCOUNT_COOKIE } from "./active-account-cookie";

export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});

export const { signIn, signUp, useSession, getSession } = authClient;

/**
 * Sign out and clean up all client-side state (cookies, etc.).
 * All sign-out actions must go through this function to avoid forgetting cleanup.
 */
export function signOutAndCleanup() {
  document.cookie = `${ACTIVE_ACCOUNT_COOKIE}=; path=/; max-age=0`;
  authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        window.location.href = "/";
      },
    },
  });
}
