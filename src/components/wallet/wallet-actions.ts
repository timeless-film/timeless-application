"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/auth/membership";
import { escapeCsvField } from "@/lib/csv";
import { formatAmount } from "@/lib/pricing/format";
import {
  createManualPayout,
  formatAmountForDisplay,
  getPayoutHistory,
  getRevenueChart,
  getWalletBalance,
  getWalletTransactions,
} from "@/lib/services/wallet-service";

import type Stripe from "stripe";

// ─── Fetch actions (pagination / period toggle) ──────────────────────────────

export async function fetchWalletTransactions(cursor?: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "rights_holder") return { error: "FORBIDDEN" as const };
  if (!ctx.account.stripeConnectAccountId || !ctx.account.stripeConnectOnboardingComplete) {
    return { error: "NOT_CONFIGURED" as const };
  }

  const result = await getWalletTransactions(ctx.account.stripeConnectAccountId, ctx.account.id, {
    startingAfter: cursor,
  });

  return { success: true as const, ...result };
}

export async function fetchWalletPayouts(cursor?: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "rights_holder") return { error: "FORBIDDEN" as const };
  if (!ctx.account.stripeConnectAccountId || !ctx.account.stripeConnectOnboardingComplete) {
    return { error: "NOT_CONFIGURED" as const };
  }

  const result = await getPayoutHistory(ctx.account.stripeConnectAccountId, {
    startingAfter: cursor,
  });

  return { success: true as const, ...result };
}

export async function fetchRevenueChart(period: "30d" | "12m") {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "rights_holder") return { error: "FORBIDDEN" as const };

  const result = await getRevenueChart(ctx.account.id, period);
  return { success: true as const, ...result };
}

// ─── Withdrawal ──────────────────────────────────────────────────────────────

export async function withdrawFunds(amount: number, currency: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "rights_holder") return { error: "FORBIDDEN" as const };

  if (!ctx.account.stripeConnectOnboardingComplete) {
    return { error: "ONBOARDING_INCOMPLETE" as const };
  }

  if (!ctx.account.stripeConnectAccountId) {
    return { error: "NOT_CONFIGURED" as const };
  }

  // Validate amount
  if (!Number.isInteger(amount) || amount <= 0) {
    return { error: "INVALID_INPUT" as const };
  }

  // Verify balance before payout
  const balance = await getWalletBalance(ctx.account.stripeConnectAccountId);
  const currencyBalance = balance.available.find(
    (b) => b.currency.toLowerCase() === currency.toLowerCase()
  );

  if (!currencyBalance || currencyBalance.amount < amount) {
    return { error: "INSUFFICIENT_BALANCE" as const };
  }

  try {
    const result = await createManualPayout(ctx.account.stripeConnectAccountId, amount, currency);

    const formattedAmount = formatAmount(amount, currency);

    // Send confirmation email (best-effort)
    try {
      const { sendWithdrawalConfirmationEmail } = await import("@/lib/email/wallet-emails");
      await sendWithdrawalConfirmationEmail({
        to: ctx.account.contactEmail ?? session.user.email,
        name: ctx.account.companyName ?? session.user.name,
        amount,
        currency,
        arrivalDate: result.arrivalDate.toISOString(),
        walletUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/wallet`,
      });
    } catch (emailError) {
      console.error("Failed to send withdrawal confirmation email:", emailError);
    }

    revalidatePath("/wallet");

    return {
      success: true as const,
      arrivalDate: result.arrivalDate.toISOString(),
      formattedAmount,
    };
  } catch (error) {
    if (isStripeError(error)) {
      if (
        error.message?.includes("insufficient funds") ||
        error.message?.includes("Insufficient")
      ) {
        return { error: "INSUFFICIENT_BALANCE" as const };
      }
      if (
        error.message?.includes("no external account") ||
        error.message?.includes("No external account")
      ) {
        return { error: "NO_BANK_ACCOUNT" as const };
      }
      if (error.message?.includes("account_closed")) {
        return { error: "BANK_ACCOUNT_CLOSED" as const };
      }
      console.error("Stripe payout error:", error.message);
      return { error: "PAYOUT_FAILED" as const };
    }
    console.error("Unexpected withdrawal error:", error);
    return { error: "PAYOUT_FAILED" as const };
  }
}

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return (
    error !== null &&
    typeof error === "object" &&
    "type" in error &&
    typeof (error as { type: unknown }).type === "string" &&
    (error as { type: string }).type.startsWith("Stripe")
  );
}

// ─── CSV export ──────────────────────────────────────────────────────────────

export async function exportTransactionsCsv(startDate: string, endDate: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "UNAUTHORIZED" as const };

  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "rights_holder") return { error: "FORBIDDEN" as const };

  if (!ctx.account.stripeConnectAccountId || !ctx.account.stripeConnectOnboardingComplete) {
    return { error: "NOT_CONFIGURED" as const };
  }

  // Fetch all transactions (paginate through all pages)
  const allTransactions: Array<{
    date: Date | string;
    filmTitle: string;
    cinemaName: string;
    orderNumber: string;
    grossAmount: number;
    commissionAmount: number;
    netAmount: number;
    taxAmount: number;
    currency: string;
  }> = [];

  let cursor: string | undefined;
  let hasMore = true;

  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (hasMore) {
    const result = await getWalletTransactions(ctx.account.stripeConnectAccountId, ctx.account.id, {
      limit: 100,
      startingAfter: cursor,
    });

    for (const tx of result.transactions) {
      const txDate = new Date(tx.date);
      if (txDate >= start && txDate <= end) {
        allTransactions.push(tx);
      }
    }

    // If the oldest transaction on this page is before start, stop paginating
    const lastTx = result.transactions[result.transactions.length - 1];
    if (lastTx && new Date(lastTx.date) < start) {
      hasMore = false;
    } else {
      hasMore = result.hasMore;
      cursor = result.nextCursor;
    }
  }

  // Build CSV with BOM for Excel compatibility
  const BOM = "\uFEFF";
  const header = "Date,Film,Cinema,Order,Gross,Commission,HT,VAT,Transferred,Currency";
  const rows = allTransactions.map((tx) => {
    const date = new Date(tx.date).toISOString().split("T")[0] ?? "";
    return [
      date,
      escapeCsvField(tx.filmTitle),
      escapeCsvField(tx.cinemaName),
      tx.orderNumber,
      formatAmountForDisplay(tx.grossAmount),
      formatAmountForDisplay(tx.commissionAmount),
      formatAmountForDisplay(tx.netAmount),
      formatAmountForDisplay(tx.taxAmount),
      formatAmountForDisplay(tx.netAmount + tx.taxAmount),
      tx.currency.toUpperCase(),
    ].join(",");
  });

  const csv = BOM + header + "\n" + rows.join("\n");

  return { success: true as const, csv };
}
