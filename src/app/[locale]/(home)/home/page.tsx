import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CollectionRowComponent } from "@/components/home/collection-row";
import { DecadeCatalog } from "@/components/home/decade-catalog";
import { EditorialCardGrid } from "@/components/home/editorial-card-grid";
import { HeroSlideshow } from "@/components/home/hero-slideshow";
import { RightsHolderDashboardContent } from "@/components/rights-holder/dashboard-content";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveAccountCookie } from "@/lib/auth/membership";
import {
  getCollectionsForSection,
  getEditorialCards,
  getFilmsByDecade,
  getSlideshowItems,
  getVisibleSections,
} from "@/lib/services/editorial-service";
import {
  getRightsHolderDashboardKpis,
  getRightsHolderRevenue,
  getRightsHolderSales,
  getRightsHolderTopFilms,
} from "@/lib/services/rights-holder-dashboard-service";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const activeCookie = await getActiveAccountCookie();
  const namespace = activeCookie?.type === "rights_holder" ? "rightsHolderDashboard" : "home";
  const t = await getTranslations(namespace);
  return {
    title: t("title"),
  };
}

export default async function HomePage() {
  const activeCookie = await getActiveAccountCookie();

  if (!activeCookie) {
    redirect("/accounts");
  }

  if (activeCookie.type === "rights_holder") {
    const [kpis, initialRevenue, initialSales, initialTopFilms] = await Promise.all([
      getRightsHolderDashboardKpis(activeCookie.accountId),
      getRightsHolderRevenue(activeCookie.accountId, "month", "12m"),
      getRightsHolderSales(activeCookie.accountId, "month", "12m"),
      getRightsHolderTopFilms(activeCookie.accountId, "12m"),
    ]);

    return (
      <RightsHolderDashboardContent
        initialKpis={kpis}
        initialRevenue={initialRevenue}
        initialSales={initialSales}
        initialTopFilms={initialTopFilms}
        initialGranularity="month"
        initialPeriod="12m"
      />
    );
  }

  // Exhibitor home — editorial sections
  const t = await getTranslations("home");
  const locale = await getLocale();

  return (
    <div className="dark bg-[#111111] text-white space-y-10 pb-12">
      <Suspense fallback={<SlideshowSkeleton />}>
        <EditorialSections
          viewFilmLabel={t("slideshow.viewFilm")}
          decadeLabel={t.raw("decade.label")}
          viewMoreLabel={t("decade.viewMore")}
          locale={locale}
        />
      </Suspense>
    </div>
  );
}

async function EditorialSections({
  viewFilmLabel,
  decadeLabel,
  viewMoreLabel,
  locale,
}: {
  viewFilmLabel: string;
  decadeLabel: string;
  viewMoreLabel: string;
  locale: string;
}) {
  const sections = await getVisibleSections(locale);

  const sectionComponents = await Promise.all(
    sections.map(async (section) => {
      switch (section.type) {
        case "slideshow": {
          const items = await getSlideshowItems(section.id, locale);
          if (items.length === 0) return null;
          return <HeroSlideshow key={section.id} items={items} viewFilmLabel={viewFilmLabel} />;
        }
        case "collection": {
          const cols = await getCollectionsForSection(section.id, locale);
          if (cols.length === 0) return null;
          return (
            <div key={section.id} className="mx-auto max-w-7xl space-y-8 px-4 lg:px-6">
              {section.title && (
                <h2 className="font-heading text-2xl tracking-tight md:text-3xl">
                  {section.title}
                </h2>
              )}
              {cols.map((col) => (
                <CollectionRowComponent key={col.id} collection={col} />
              ))}
            </div>
          );
        }
        case "card_grid": {
          const cards = await getEditorialCards(section.id, locale);
          if (cards.length === 0) return null;
          return (
            <div key={section.id} className="mx-auto max-w-7xl px-4 lg:px-6">
              {section.title && (
                <h2 className="font-heading mb-4 text-2xl tracking-tight md:text-3xl">
                  {section.title}
                </h2>
              )}
              <EditorialCardGrid cards={cards} />
            </div>
          );
        }
        case "decade_catalog": {
          const decades = await getFilmsByDecade();
          if (decades.length === 0) return null;
          return (
            <div key={section.id} className="mx-auto max-w-7xl px-4 lg:px-6">
              {section.title && (
                <h2 className="font-heading mb-4 text-2xl tracking-tight md:text-3xl">
                  {section.title}
                </h2>
              )}
              <DecadeCatalog
                decades={decades}
                decadeLabel={decadeLabel}
                viewMoreLabel={viewMoreLabel}
              />
            </div>
          );
        }
        default:
          return null;
      }
    })
  );

  const rendered = sectionComponents.filter(Boolean);

  if (rendered.length === 0) {
    // Fallback when no editorial content is configured
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-6">
        <Suspense fallback={null}>
          <DecadeCatalogFallback decadeLabel={decadeLabel} viewMoreLabel={viewMoreLabel} />
        </Suspense>
      </div>
    );
  }

  return <>{rendered}</>;
}

async function DecadeCatalogFallback({
  decadeLabel,
  viewMoreLabel,
}: {
  decadeLabel: string;
  viewMoreLabel: string;
}) {
  const decades = await getFilmsByDecade();
  if (decades.length === 0) return null;
  return (
    <DecadeCatalog decades={decades} decadeLabel={decadeLabel} viewMoreLabel={viewMoreLabel} />
  );
}

function SlideshowSkeleton() {
  return (
    <div className="space-y-10">
      <Skeleton className="aspect-[21/9] w-full md:aspect-[2.5/1]" />
      <div className="mx-auto max-w-7xl space-y-4 px-4 lg:px-6">
        <Skeleton className="h-6 w-48" />
        <div className="flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-[180px] shrink-0 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
