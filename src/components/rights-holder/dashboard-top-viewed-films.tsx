"use client";

import { Eye, Film } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { TopViewedFilm } from "@/lib/services/rights-holder-dashboard-service";

interface RightsHolderTopViewedFilmsProps {
  data: TopViewedFilm[];
}

export function RightsHolderTopViewedFilms({ data }: RightsHolderTopViewedFilmsProps) {
  const t = useTranslations("rightsHolderDashboard.topViewedFilms");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <div className="space-y-3">
            {data.map((film, index) => (
              <div key={film.filmId} className="flex items-center gap-3 py-1">
                <span className="text-muted-foreground w-5 shrink-0 text-center text-sm font-medium">
                  {index + 1}
                </span>

                {film.posterUrl ? (
                  <Image
                    src={film.posterUrl}
                    alt={film.title}
                    width={28}
                    height={42}
                    className="h-[42px] w-[28px] shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="bg-muted flex h-[42px] w-[28px] shrink-0 items-center justify-center rounded">
                    <Film className="text-muted-foreground h-4 w-4" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{film.title}</p>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Eye className="h-3 w-3" />
                    <span>
                      {film.viewCount} {t("views")}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
