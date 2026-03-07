"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { accountMembers } from "@/lib/db/schema";

async function getCurrentMembership() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return null;
  }

  const membership = await db.query.accountMembers.findFirst({
    where: (am, { eq: eq2 }) => eq2(am.userId, session.user.id),
    with: { account: true },
  });

  return membership ? { ...membership, session } : null;
}

export async function getMembers() {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED", members: [] };

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
  if (!ctx) return { error: "UNAUTHORIZED" };

  // Only owner and admin can change roles
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" };
  }

  // Cannot change owner role
  const target = await db.query.accountMembers.findFirst({
    where: (am, { eq: eq2 }) => eq2(am.id, memberId),
  });

  if (!target || target.accountId !== ctx.accountId) {
    return { error: "NOT_FOUND" };
  }

  if (target.role === "owner") {
    return { error: "CANNOT_CHANGE_OWNER" };
  }

  // Admin cannot promote to admin (only owner can)
  if (ctx.role === "admin" && role === "admin") {
    return { error: "FORBIDDEN" };
  }

  await db.update(accountMembers).set({ role }).where(eq(accountMembers.id, memberId));

  return { success: true };
}

export async function removeMember(memberId: string) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" };

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return { error: "FORBIDDEN" };
  }

  const target = await db.query.accountMembers.findFirst({
    where: (am, { eq: eq2 }) => eq2(am.id, memberId),
  });

  if (!target || target.accountId !== ctx.accountId) {
    return { error: "NOT_FOUND" };
  }

  if (target.role === "owner") {
    return { error: "CANNOT_REMOVE_OWNER" };
  }

  // Cannot remove self
  if (target.userId === ctx.session.user.id) {
    return { error: "CANNOT_REMOVE_SELF" };
  }

  await db.delete(accountMembers).where(eq(accountMembers.id, memberId));

  return { success: true };
}
