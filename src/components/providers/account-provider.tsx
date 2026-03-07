"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { MembershipInfo } from "@/types/account";
import type { ReactNode } from "react";

// ─── Context shape ────────────────────────────────────────────────────────────

interface AccountContextValue {
  /** All memberships for the current user */
  memberships: MembershipInfo[];
  /** ID of the currently active account */
  activeAccountId: string;
  /** The active membership (derived) */
  activeMembership: MembershipInfo | undefined;
  /** Whether the user has multiple accounts */
  hasMultipleAccounts: boolean;
  /** Update the active account client-side (instant UI update) */
  setActiveAccountId: (accountId: string) => void;
  /** Add a new membership to the list (e.g. after onboarding) */
  addMembership: (membership: MembershipInfo) => void;
}

const AccountContext = createContext<AccountContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface AccountProviderProps {
  children: ReactNode;
  /** Initial memberships from the server layout */
  initialMemberships: MembershipInfo[];
  /** Initial active account ID from the server cookie */
  initialActiveAccountId: string;
}

export function AccountProvider({
  children,
  initialMemberships,
  initialActiveAccountId,
}: AccountProviderProps) {
  const [memberships, setMemberships] = useState(initialMemberships);
  const [activeAccountId, setActiveAccountId] = useState(initialActiveAccountId);

  const activeMembership = useMemo(
    () => memberships.find((m) => m.accountId === activeAccountId),
    [memberships, activeAccountId]
  );

  const hasMultipleAccounts = memberships.length > 1;

  const addMembership = useCallback((membership: MembershipInfo) => {
    setMemberships((prev) => [...prev, membership]);
    setActiveAccountId(membership.accountId);
  }, []);

  const value = useMemo<AccountContextValue>(
    () => ({
      memberships,
      activeAccountId,
      activeMembership,
      hasMultipleAccounts,
      setActiveAccountId,
      addMembership,
    }),
    [memberships, activeAccountId, activeMembership, hasMultipleAccounts, addMembership]
  );

  return <AccountContext value={value}>{children}</AccountContext>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAccountContext(): AccountContextValue {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccountContext must be used within an AccountProvider");
  }
  return context;
}
