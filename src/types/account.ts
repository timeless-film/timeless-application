import type { AccountType } from "@/lib/auth/active-account-cookie";

/**
 * Membership information passed from server layouts to client components.
 * Includes the joined account data for display (company name, type).
 */
export interface MembershipInfo {
  id: string;
  accountId: string;
  role: string;
  account: {
    id: string;
    companyName: string;
    type: AccountType;
  };
}
