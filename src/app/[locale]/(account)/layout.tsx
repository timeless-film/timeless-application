import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { auth } from "@/lib/auth";
import { getActiveAccountCookie } from "@/lib/auth/membership";

import type { ReactNode } from "react";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const t = await getTranslations("navigation");
  const activeCookie = await getActiveAccountCookie();

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
