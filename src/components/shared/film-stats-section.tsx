import { getTranslations } from "next-intl/server";

import { FilmStatsChart } from "@/components/shared/film-stats-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFilmEventStats } from "@/lib/services/film-event-service";

interface FilmStatsSectionProps {
  filmId: string;
  currency?: string;
}

export async function FilmStatsSection({ filmId, currency }: FilmStatsSectionProps) {
  const t = await getTranslations("filmStats");
  const stats = await getFilmEventStats(filmId, 30);

  const hasAnyData =
    stats.totalViews > 0 ||
    stats.totalCartAdds > 0 ||
    stats.totalRequests > 0 ||
    stats.totalRevenue > 0;

  if (!hasAnyData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="font-heading text-lg">{t("title")}</h2>
      <FilmStatsChart stats={stats} currency={currency} />
    </div>
  );
}
