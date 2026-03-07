"use server";

import { randomUUID } from "crypto";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountMembers, invitations } from "@/lib/db/schema";

async function getCurrentMembership() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  const membership = await db.query.accountMembers.findFirst({
    where: (am, { eq: eq2 }) => eq2(am.userId, session.user.id),
    with: { account: true },
  });

  return membership ? { ...membership, session } : null;
}

export async function inviteMember(input: { email: string; role: "admin" | "member" }) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" };
  }

  // Admin cannot invite as admin
  if (ctx.role === "admin" && input.role === "admin") {
    return { error: "FORBIDDEN" };
  }

  // Check for existing pending invitation
  const existingInvitation = await db.query.invitations.findFirst({
    where: (inv, { eq: eq2, and, isNull }) =>
      and(eq2(inv.accountId, ctx.accountId), eq2(inv.email, input.email), isNull(inv.acceptedAt)),
  });

  if (existingInvitation) {
    return { error: "ALREADY_INVITED" };
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

  // TODO: integrate Customer.io to send invitation email
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/accept-invitation?token=${token}`;
  console.warn(`Invitation for ${input.email}: ${inviteUrl}`);

  return { success: true };
}

export async function getPendingInvitations() {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED", invitations: [] };

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
  if (!ctx) return { error: "UNAUTHORIZED" };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" };
  }

  const invitation = await db.query.invitations.findFirst({
    where: (inv, { eq: eq2 }) => eq2(inv.id, invitationId),
  });

  if (!invitation || invitation.accountId !== ctx.accountId) {
    return { error: "NOT_FOUND" };
  }

  await db.delete(invitations).where(eq(invitations.id, invitationId));

  return { success: true };
}

export async function acceptInvitation(token: string) {
  // Get current session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "UNAUTHORIZED" };
  }

  // Find the invitation
  const invitation = await db.query.invitations.findFirst({
    where: (inv, { eq: eq2, and, isNull, gt }) =>
      and(eq2(inv.token, token), isNull(inv.acceptedAt), gt(inv.expiresAt, new Date())),
  });

  if (!invitation) {
    return { error: "INVALID_TOKEN" };
  }

  // Verify email matches
  if (invitation.email !== session.user.email) {
    return { error: "EMAIL_MISMATCH" };
  }

  // Check if user is already a member
  const existingMembership = await db.query.accountMembers.findFirst({
    where: (am, { eq: eq2, and }) =>
      and(eq2(am.accountId, invitation.accountId), eq2(am.userId, session.user.id)),
  });

  if (existingMembership) {
    return { error: "ALREADY_MEMBER" };
  }

  // Create membership
  await db.insert(accountMembers).values({
    accountId: invitation.accountId,
    userId: session.user.id,
    role: invitation.role,
  });

  // Mark invitation as accepted
  await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.id, invitation.id));

  return { success: true, accountId: invitation.accountId };
}
