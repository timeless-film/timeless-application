"use server";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";

export async function updateProfile(input: { name: string }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "UNAUTHORIZED" };
  }

  try {
    await auth.api.updateUser({
      headers: await headers(),
      body: {
        name: input.name,
      },
    });
    return { success: true };
  } catch {
    return { error: "UPDATE_FAILED" };
  }
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "UNAUTHORIZED" };
  }

  try {
    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      },
    });
    return { success: true };
  } catch {
    return { error: "CHANGE_FAILED" };
  }
}

export async function listSessions() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "UNAUTHORIZED", sessions: [] };
  }

  try {
    const sessions = await auth.api.listSessions({
      headers: await headers(),
    });
    return { sessions };
  } catch {
    return { error: "FETCH_FAILED", sessions: [] };
  }
}

export async function revokeSession(sessionToken: string) {
  const currentSession = await auth.api.getSession({
    headers: await headers(),
  });

  if (!currentSession) {
    return { error: "UNAUTHORIZED" };
  }

  try {
    await auth.api.revokeSession({
      headers: await headers(),
      body: { token: sessionToken },
    });
    return { success: true };
  } catch {
    return { error: "REVOKE_FAILED" };
  }
}

export async function revokeAllOtherSessions() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { error: "UNAUTHORIZED" };
  }

  try {
    await auth.api.revokeSessions({
      headers: await headers(),
    });
    return { success: true };
  } catch {
    return { error: "REVOKE_FAILED" };
  }
}
