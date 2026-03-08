import { AlertTriangle } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

interface StripeConnectBannerProps {
  canManage: boolean;
}

export async function StripeConnectBanner({ canManage }: StripeConnectBannerProps) {
  const t = await getTranslations("stripeConnect");

  const content = (
    <div className="flex items-center gap-3">
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <span className="text-sm font-medium">{t("banner.message")}</span>
      {canManage && (
        <span className="ml-auto text-sm font-semibold underline underline-offset-4">
          {t("banner.cta")}
        </span>
      )}
    </div>
  );

  if (canManage) {
    return (
      <Link
        href="/account/stripe-connect"
        className="block border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      {content}
    </div>
  );
}
