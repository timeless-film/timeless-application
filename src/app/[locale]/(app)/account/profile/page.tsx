import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { auth } from "@/lib/auth";

import { listSessions } from "./actions";
import { ProfileForm } from "./profile-form";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return {
    title: t("title"),
  };
}

export default async function ProfilePage() {
  const [{ sessions }, session] = await Promise.all([
    listSessions(),
    auth.api.getSession({ headers: await headers() }),
  ]);

  // Normalize session data for client component
  const normalizedSessions = (sessions ?? []).map((s) => ({
    id: s.id,
    token: s.token,
    userAgent: s.userAgent ?? null,
    ipAddress: s.ipAddress ?? null,
    createdAt: s.createdAt,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ProfileForm
        initialSessions={normalizedSessions}
        initialName={session?.user.name ?? ""}
        initialEmail={session?.user.email ?? ""}
        currentSessionToken={session?.session.token ?? ""}
      />
    </div>
  );
}
