"use client";

import { CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AcceptInvitationResultProps {
  status: "success" | "error";
  errorKey?: string;
}

export function AcceptInvitationResult({ status, errorKey }: AcceptInvitationResultProps) {
  const t = useTranslations("acceptInvitation");
  const router = useRouter();

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
              <Button onClick={() => router.push("/")}>{t("continue")}</Button>
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
