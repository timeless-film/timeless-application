"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { MarkdownRenderer } from "@/components/shared/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";

import { acceptTermsOfService } from "./actions";

interface AcceptTermsFormProps {
  documentVersion: string;
  documentContent: string;
}

export function AcceptTermsForm({ documentVersion, documentContent }: AcceptTermsFormProps) {
  const t = useTranslations("legal.acceptTerms");
  const router = useRouter();

  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setLoading(true);
    const result = await acceptTermsOfService();

    if ("error" in result) {
      toast.error(t("error"));
      setLoading(false);
      return;
    }

    toast.success(t("success"));
    router.replace("/home");
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">{t("pageTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("version", { version: documentVersion })}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <div className="max-h-96 overflow-y-auto rounded-md border p-4">
          <MarkdownRenderer content={documentContent} />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="accept-cgu"
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked === true)}
          />
          <Label htmlFor="accept-cgu" className="text-sm font-normal leading-snug">
            {t("checkbox")}
          </Label>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleAccept} className="w-full" disabled={!accepted || loading}>
          {loading && <Loader2 className="animate-spin" />}
          {t("submit")}
        </Button>
      </CardFooter>
    </Card>
  );
}
