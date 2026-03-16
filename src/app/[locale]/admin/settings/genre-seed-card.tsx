"use client";

import { Database } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { seedGenresAction } from "./actions";

interface GenreSeedCardProps {
  initialTotal: number;
}

export function GenreSeedCard({ initialTotal }: GenreSeedCardProps) {
  const t = useTranslations("admin.settings.genres");
  const [isPending, startTransition] = useTransition();
  const [total, setTotal] = useState(initialTotal);

  function handleSeed() {
    startTransition(async () => {
      const result = await seedGenresAction();

      if ("error" in result) {
        toast.error(t(`error.${result.error}`));
        return;
      }

      setTotal(result.data.total);

      if (result.data.inserted === 0) {
        toast.info(t("alreadyComplete"));
      } else {
        toast.success(t("seeded", { count: result.data.inserted }));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="size-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("currentCount")}</span>
          <Badge variant="secondary">{total}</Badge>
        </div>
        <Button onClick={handleSeed} disabled={isPending} variant="outline" size="sm">
          {isPending ? t("seeding") : t("seedButton")}
        </Button>
      </CardContent>
    </Card>
  );
}
