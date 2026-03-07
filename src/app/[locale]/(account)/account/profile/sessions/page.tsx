import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { listSessions } from "@/components/profile/actions";
import { SessionsList } from "@/components/profile/sessions-list";
import { auth } from "@/lib/auth";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return {
    title: t("tabs.sessions"),
  };
}

export default async function SessionsPage() {
  const [{ sessions }, session] = await Promise.all([
    listSessions(),
    auth.api.getSession({ headers: await headers() }),
  ]);

  const normalizedSessions = (sessions ?? []).map((s) => ({
    id: s.id,
    token: s.token,
    userAgent: s.userAgent ?? null,
    ipAddress: s.ipAddress ?? null,
    createdAt: s.createdAt,
  }));

  return (
    <SessionsList
      sessions={normalizedSessions}
      currentSessionToken={session?.session.token ?? ""}
    />
  );
}
