"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/auth/membership";
import { db } from "@/lib/db";
import { accountMembers, accounts, invitations } from "@/lib/db/schema";
import { sendInvitationEmail } from "@/lib/email";

// ─── Account Info ─────────────────────────────────────────────────────────────

export async function getAccountInfo() {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  const account = await db.query.accounts.findFirst({
    where: (a, { eq: eq2 }) => eq2(a.id, ctx.accountId),
  });

  if (!account) return { error: "NOT_FOUND" as const };

  return {
    account: {
      id: account.id,
      type: account.type,
      companyName: account.companyName,
      country: account.country,
      address: account.address,
      city: account.city,
      postalCode: account.postalCode,
      vatNumber: account.vatNumber,
      vatValidated: account.vatValidated,
      preferredCurrency: account.preferredCurrency,
      contactEmail: account.contactEmail,
      contactPhone: account.contactPhone,
      cinemaType: account.cinemaType,
    },
    currentUserRole: ctx.role,
  };
}

export async function updateAccountInfo(input: {
  companyName: string;
  country: string;
  address?: string;
  city?: string;
  postalCode?: string;
  vatNumber?: string;
  preferredCurrency?: string;
  contactEmail?: string;
  contactPhone?: string;
  cinemaType?: string;
}) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  if (!input.companyName.trim()) {
    return { error: "INVALID_INPUT" as const };
  }

  await db
    .update(accounts)
    .set({
      companyName: input.companyName.trim(),
      country: input.country,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      vatNumber: input.vatNumber?.trim() || null,
      preferredCurrency: input.preferredCurrency || null,
      contactEmail: input.contactEmail?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
      // SAFETY: cinemaType is validated by the pgEnum constraint in the database
      cinemaType: (input.cinemaType as typeof accounts.$inferInsert.cinemaType) || null,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, ctx.accountId));

  return { success: true };
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getMembers() {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const, members: [] };

  const members = await db.query.accountMembers.findMany({
    where: (am, { eq: eq2 }) => eq2(am.accountId, ctx.accountId),
    with: { user: true },
    orderBy: (am, { asc }) => asc(am.createdAt),
  });

  return {
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      createdAt: m.createdAt,
      isCurrentUser: m.userId === ctx.session.user.id,
    })),
    currentUserRole: ctx.role,
  };
}

export async function updateMemberRole(memberId: string, role: "admin" | "member") {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const target = await db.query.accountMembers.findFirst({
    where: (am, { eq: eq2 }) => eq2(am.id, memberId),
  });

  if (!target || target.accountId !== ctx.accountId) {
    return { error: "NOT_FOUND" as const };
  }

  if (target.role === "owner") {
    return { error: "CANNOT_CHANGE_OWNER" as const };
  }

  // Admin cannot promote to admin (only owner can)
  if (ctx.role === "admin" && role === "admin") {
    return { error: "FORBIDDEN" as const };
  }

  await db.update(accountMembers).set({ role }).where(eq(accountMembers.id, memberId));

  return { success: true };
}

export async function removeMember(memberId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const target = await db.query.accountMembers.findFirst({
    where: (am, { eq: eq2 }) => eq2(am.id, memberId),
  });

  if (!target || target.accountId !== ctx.accountId) {
    return { error: "NOT_FOUND" as const };
  }

  if (target.role === "owner") {
    return { error: "CANNOT_REMOVE_OWNER" as const };
  }

  if (target.userId === ctx.session.user.id) {
    return { error: "CANNOT_REMOVE_SELF" as const };
  }

  await db.delete(accountMembers).where(eq(accountMembers.id, memberId));

  return { success: true };
}

// ─── Invitations ──────────────────────────────────────────────────────────────

export async function inviteMember(input: { email: string; role: "admin" | "member" }) {
  const { randomUUID } = await import("crypto");

  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  // Admin cannot invite as admin
  if (ctx.role === "admin" && input.role === "admin") {
    return { error: "FORBIDDEN" as const };
  }

  // Check for existing pending invitation
  const existingInvitation = await db.query.invitations.findFirst({
    where: (inv, { eq: eq2, and, isNull }) =>
      and(eq2(inv.accountId, ctx.accountId), eq2(inv.email, input.email), isNull(inv.acceptedAt)),
  });

  if (existingInvitation) {
    return { error: "ALREADY_INVITED" as const };
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(invitations).values({
    accountId: ctx.accountId,
    email: input.email,
    role: input.role,
    token,
    expiresAt,
    invitedByUserId: ctx.session.user.id,
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/accept-invitation?token=${token}`;

  await sendInvitationEmail({
    email: input.email,
    inviteUrl,
    inviterName: ctx.session.user.name,
    accountName: ctx.account.companyName,
    role: input.role,
  });

  return { success: true };
}

export async function getPendingInvitations() {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const, invitations: [] };

  const pending = await db.query.invitations.findMany({
    where: (inv, { eq: eq2, and, isNull, gt }) =>
      and(eq2(inv.accountId, ctx.accountId), isNull(inv.acceptedAt), gt(inv.expiresAt, new Date())),
    orderBy: (inv, { desc }) => desc(inv.createdAt),
  });

  return {
    invitations: pending.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    })),
  };
}

export async function cancelInvitation(invitationId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const invitation = await db.query.invitations.findFirst({
    where: (inv, { eq: eq2 }) => eq2(inv.id, invitationId),
  });

  if (!invitation || invitation.accountId !== ctx.accountId) {
    return { error: "NOT_FOUND" as const };
  }

  await db.delete(invitations).where(eq(invitations.id, invitationId));

  return { success: true };
}

// ─── Accept Invitation ────────────────────────────────────────────────────────

export async function acceptInvitation(token: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "UNAUTHORIZED" as const };
  }

  const invitation = await db.query.invitations.findFirst({
    where: (inv, { eq: eq2, and, isNull, gt }) =>
      and(eq2(inv.token, token), isNull(inv.acceptedAt), gt(inv.expiresAt, new Date())),
  });

  if (!invitation) {
    return { error: "INVALID_TOKEN" as const };
  }

  if (invitation.email !== session.user.email) {
    return { error: "EMAIL_MISMATCH" as const };
  }

  const existingMembership = await db.query.accountMembers.findFirst({
    where: (am, { eq: eq2, and }) =>
      and(eq2(am.accountId, invitation.accountId), eq2(am.userId, session.user.id)),
  });

  if (existingMembership) {
    return { error: "ALREADY_MEMBER" as const };
  }

  await db.insert(accountMembers).values({
    accountId: invitation.accountId,
    userId: session.user.id,
    role: invitation.role,
  });

  await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.id, invitation.id));

  return { success: true, accountId: invitation.accountId };
}

// ─── Pending Invitations (for current user's email) ───────────────────────────

export async function getMyPendingInvitations() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "UNAUTHORIZED" as const, invitations: [] };
  }

  const pending = await db.query.invitations.findMany({
    where: (inv, { eq: eq2, and, isNull, gt }) =>
      and(
        eq2(inv.email, session.user.email),
        isNull(inv.acceptedAt),
        gt(inv.expiresAt, new Date())
      ),
    with: {
      account: true,
    },
    orderBy: (inv, { desc }) => desc(inv.createdAt),
  });

  return {
    invitations: pending.map((inv) => ({
      id: inv.id,
      role: inv.role,
      accountName: inv.account.companyName,
      accountType: inv.account.type,
      expiresAt: inv.expiresAt,
    })),
  };
}

export async function acceptInvitationById(invitationId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "UNAUTHORIZED" as const };
  }

  const invitation = await db.query.invitations.findFirst({
    where: (inv, { eq: eq2, and, isNull, gt }) =>
      and(eq2(inv.id, invitationId), isNull(inv.acceptedAt), gt(inv.expiresAt, new Date())),
    with: { account: true },
  });

  if (!invitation) {
    return { error: "NOT_FOUND" as const };
  }

  if (invitation.email !== session.user.email) {
    return { error: "EMAIL_MISMATCH" as const };
  }

  const existingMembership = await db.query.accountMembers.findFirst({
    where: (am, { eq: eq2, and }) =>
      and(eq2(am.accountId, invitation.accountId), eq2(am.userId, session.user.id)),
  });

  if (existingMembership) {
    return { error: "ALREADY_MEMBER" as const };
  }

  await db.insert(accountMembers).values({
    accountId: invitation.accountId,
    userId: session.user.id,
    role: invitation.role,
  });

  await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.id, invitation.id));

  return {
    success: true,
    accountId: invitation.accountId,
    accountName: invitation.account.companyName,
    accountType: invitation.account.type,
  };
}
