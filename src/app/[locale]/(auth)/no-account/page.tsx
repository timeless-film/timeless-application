import { MailIcon, PlusCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

export default function NoAccountPage() {
  const t = useTranslations("noAccount");

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="font-heading text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button asChild className="w-full">
          <Link href="/onboarding">
            <PlusCircleIcon className="mr-2 h-4 w-4" />
            {t("createAccount")}
          </Link>
        </Button>
        <Button variant="outline" asChild className="w-full">
          <a href="mailto:support@timeless.film">
            <MailIcon className="mr-2 h-4 w-4" />
            {t("contactSupport")}
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
