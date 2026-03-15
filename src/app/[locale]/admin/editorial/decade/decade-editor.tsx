"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import { getAvailableDecadesAction, updateSectionAction } from "../actions";

interface DecadeEditorProps {
  sectionId: string;
  initialConfig: { decades?: number[] } | null;
}

export function DecadeEditor({ sectionId, initialConfig }: DecadeEditorProps) {
  const t = useTranslations("admin.editorial");
  const [isPending, startTransition] = useTransition();
  const [availableDecades, setAvailableDecades] = useState<number[] | null>(null);
  const [selectedDecades, setSelectedDecades] = useState<number[]>(initialConfig?.decades ?? []);

  useEffect(() => {
    async function load() {
      const result = await getAvailableDecadesAction();
      if ("decades" in result) {
        setAvailableDecades(result.decades);
      }
    }
    load();
  }, []);

  function handleToggle(decade: number, checked: boolean) {
    const updated = checked
      ? [...selectedDecades, decade].sort((a, b) => b - a)
      : selectedDecades.filter((d) => d !== decade);

    setSelectedDecades(updated);

    startTransition(async () => {
      const result = await updateSectionAction(sectionId, {
        config: { decades: updated },
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(t("saved"));
    });
  }

  if (availableDecades === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-40" />
        ))}
      </div>
    );
  }

  if (availableDecades.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noCards")}</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">{t("decadeTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("decadeDescription")}</p>
      </div>
      <div className="space-y-2">
        {availableDecades.map((decade) => (
          <div key={decade} className="flex items-center gap-2">
            <Checkbox
              id={`decade-${decade}`}
              checked={selectedDecades.includes(decade)}
              onCheckedChange={(checked) => handleToggle(decade, checked === true)}
              disabled={isPending}
            />
            <Label htmlFor={`decade-${decade}`} className="cursor-pointer text-sm">
              {decade}s
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
