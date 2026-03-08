import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { getActiveAccountCookie, getAllMemberships } from "@/lib/auth/membership";

import type { ReactNode } from "react";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  // Onboarding guard — exhibitors must complete onboarding before accessing account pages
  const [activeCookie, memberships] = await Promise.all([
    getActiveAccountCookie(),
    getAllMemberships(session.user.id),
  ]);

  if (activeCookie && activeCookie.type === "exhibitor") {
    const activeMembership = memberships.find((m) => m.accountId === activeCookie.accountId);
    if (activeMembership && !activeMembership.account.onboardingCompleted) {
      const headersList = await headers();
      const pathname = headersList.get("x-pathname") ?? "";
      const locale = pathname.split("/")[1] ?? "en";
      redirect(`/${locale}/onboarding`);
    }
  }

  const t = await getTranslations("navigation");

  const isRightsHolder = activeCookie?.type === "rights_holder";
  const isAdmin = activeCookie?.type === "admin";
  const backHref = isAdmin ? "/dashboard" : isRightsHolder ? "/films" : "/catalog";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4 lg:px-6">
          <Link
            href={backHref}
            className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </Link>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
