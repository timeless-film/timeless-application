"use client";

import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { switchAccount } from "@/lib/auth/membership-actions";

interface AcceptInvitationResultProps {
  status: "success" | "error";
  errorKey?: string;
  accountId?: string;
}

export function AcceptInvitationResult({
  status,
  errorKey,
  accountId,
}: AcceptInvitationResultProps) {
  const t = useTranslations("acceptInvitation");
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  // Auto-switch to the new account after successful acceptance
  useEffect(() => {
    if (status === "success" && accountId) {
      setSwitching(true);
      switchAccount(accountId).then((result) => {
        if ("error" in result) {
          setSwitching(false);
          return;
        }
        toast.success(t("switchedToAccount", { name: result.accountName }));
        router.push(result.redirectUrl);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === "success" && (
            <>
              <CheckCircle className="h-8 w-8 text-green-600" />
              <p className="text-sm">{t("successMessage")}</p>
              {switching ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <Button onClick={() => router.push("/")}>{t("continue")}</Button>
              )}
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-destructive">{t(`error.${errorKey ?? "UNKNOWN"}`)}</p>
              <Button variant="outline" onClick={() => router.push("/")}>
                {t("goHome")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
