"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { ACTIVE_ACCOUNT_COOKIE } from "@/lib/auth/active-account-cookie";
import { signOut } from "@/lib/auth/client";

interface AlreadyConnectedProps {
  name: string;
  email: string;
}

export function AlreadyConnected({ name, email }: AlreadyConnectedProps) {
  const t = useTranslations("auth.alreadyConnected");

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-center text-sm text-muted-foreground">{t("message", { name, email })}</p>
      </CardContent>
      <CardFooter className="flex-col gap-3">
        <Link href="/catalog" className="w-full">
          <Button className="w-full">{t("dashboard")}</Button>
        </Link>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            document.cookie = `${ACTIVE_ACCOUNT_COOKIE}=; path=/; max-age=0`;
            signOut({
              fetchOptions: {
                onSuccess: () => {
                  window.location.href = "/";
                },
              },
            });
          }}
        >
          {t("signOut")}
        </Button>
      </CardFooter>
    </Card>
  );
}
