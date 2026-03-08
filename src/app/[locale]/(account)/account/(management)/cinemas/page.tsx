import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { CinemaList } from "@/components/account/cinemas/cinema-list";
import { auth } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/auth/membership";
import { listCinemasForAccount } from "@/lib/services/cinema-service";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accountSettings");
  return {
    title: t("tabs.cinemas"),
  };
}

export default async function CinemasPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const ctx = await getCurrentMembership();
  if (!ctx) return null;

  const cinemas = await listCinemasForAccount(ctx.accountId);

  return (
    <div className="space-y-6">
      <CinemaList
        initialCinemas={cinemas}
        currentUserRole={ctx.role}
        accountCountry={ctx.account.country}
        accountAddress={ctx.account.address}
        accountCity={ctx.account.city}
        accountPostalCode={ctx.account.postalCode}
      />
    </div>
  );
}
