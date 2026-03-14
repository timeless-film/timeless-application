"use client";

import { Film, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/pricing/format";
import { cn } from "@/lib/utils";

import type { TopFilm } from "@/lib/services/admin-dashboard-service";

// ─── Constants ────────────────────────────────────────────────────────────────

const MEDAL_COLORS = [
  "from-yellow-400/20 to-yellow-500/5 border-yellow-400/40", // gold
  "from-slate-300/20 to-slate-400/5 border-slate-300/40", // silver
  "from-amber-600/20 to-amber-700/5 border-amber-600/30", // bronze
] as const;

const MEDAL_RING = ["ring-yellow-400/50", "ring-slate-300/50", "ring-amber-600/40"] as const;

const MEDAL_EMOJI = ["🥇", "🥈", "🥉"] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function PodiumCard({
  film,
  rank,
  locale,
  volumeLabel,
  ordersLabel,
}: {
  film: TopFilm;
  rank: number;
  locale: string;
  volumeLabel: string;
  ordersLabel: string;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center rounded-xl border bg-gradient-to-b p-4 pt-5 transition-shadow hover:shadow-md",
        MEDAL_COLORS[rank]
      )}
    >
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl">
        {MEDAL_EMOJI[rank]}
      </span>

      {/* Poster */}
      <div className={cn("mb-3 overflow-hidden rounded-lg shadow-sm ring-2", MEDAL_RING[rank])}>
        {film.posterUrl ? (
          <Image
            src={film.posterUrl}
            alt={film.title}
            width={80}
            height={120}
            className="h-[120px] w-[80px] object-cover"
          />
        ) : (
          <div className="bg-muted flex h-[120px] w-[80px] items-center justify-center">
            <Film className="text-muted-foreground h-8 w-8" />
          </div>
        )}
      </div>

      {/* Info */}
      <h3 className="mb-0.5 line-clamp-2 text-center text-sm font-semibold leading-tight">
        <Link
          href={`/${locale}/admin/films/${film.filmId}`}
          className="text-primary hover:underline"
        >
          {film.title}
        </Link>
      </h3>
      <p className="text-muted-foreground mb-3 text-center text-xs">
        <Link
          href={`/${locale}/admin/rights-holders/${film.rightsHolderAccountId}`}
          className="hover:underline"
        >
          {film.rightsHolderName}
        </Link>
      </p>

      {/* Stats */}
      <div className="mt-auto flex w-full justify-between gap-2 text-xs">
        <div className="text-center">
          <p className="text-muted-foreground">{ordersLabel}</p>
          <p className="font-bold">{film.orderCount}</p>
        </div>
        <div className="text-center">
          <p className="text-muted-foreground">{volumeLabel}</p>
          <p className="font-bold">{formatAmount(film.totalVolume, "EUR", locale)}</p>
        </div>
      </div>
    </div>
  );
}

function RunnerUpRow({ film, rank, locale }: { film: TopFilm; rank: number; locale: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-muted-foreground w-5 shrink-0 text-center text-sm font-medium">
        {rank}
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
          <Film className="text-muted-foreground h-3.5 w-3.5" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          <Link
            href={`/${locale}/admin/films/${film.filmId}`}
            className="text-primary hover:underline"
          >
            {film.title}
          </Link>
        </p>
        <p className="text-muted-foreground truncate text-xs">
          <Link
            href={`/${locale}/admin/rights-holders/${film.rightsHolderAccountId}`}
            className="hover:underline"
          >
            {film.rightsHolderName}
          </Link>
        </p>
      </div>

      <span className="text-muted-foreground shrink-0 text-xs">{film.orderCount} cmd</span>
      <span className="shrink-0 text-sm font-medium tabular-nums">
        {formatAmount(film.totalVolume, "EUR", locale)}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DashboardTopFilmsProps {
  data: TopFilm[];
}

export function DashboardTopFilms({ data }: DashboardTopFilmsProps) {
  const t = useTranslations("admin.dashboard.topFilms");
  const locale = useLocale();

  const podium = data.slice(0, 3);
  const runners = data.slice(3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">{t("empty")}</p>
        ) : (
          <div className="space-y-6">
            {/* Podium — top 3 */}
            <div className="grid grid-cols-3 gap-3">
              {podium.map((film, i) => (
                <PodiumCard
                  key={film.filmId}
                  film={film}
                  rank={i}
                  locale={locale}
                  volumeLabel={t("columns.volume")}
                  ordersLabel={t("columns.orders")}
                />
              ))}
            </div>

            {/* Runners-up — 4 to 10 */}
            {runners.length > 0 && (
              <div className="divide-border/50 divide-y">
                {runners.map((film, i) => (
                  <RunnerUpRow key={film.filmId} film={film} rank={i + 4} locale={locale} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
