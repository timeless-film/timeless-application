import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { ACTIVE_ACCOUNT_COOKIE, parseActiveAccountCookie } from "@/lib/auth/active-account-cookie";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { getCatalogFilterOptions, getCatalogForExhibitor } from "@/lib/services/catalog-service";

import { CatalogPageContent } from "./catalog-page-content";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalog");
  return {
    title: t("title"),
  };
}

// ─── Query Params Schema ──────────────────────────────────────────────────────

const catalogSearchParamsSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(24),
  sort: z.enum(["title", "releaseYear", "price"]).optional().default("title"),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
  search: z.string().optional(),
  directors: z.union([z.string(), z.array(z.string())]).optional(),
  cast: z.union([z.string(), z.array(z.string())]).optional(),
  genres: z.union([z.string(), z.array(z.string())]).optional(),
  countries: z.union([z.string(), z.array(z.string())]).optional(),
  rightsHolderIds: z.union([z.string(), z.array(z.string())]).optional(),
  companies: z.union([z.string(), z.array(z.string())]).optional(),
  type: z.enum(["direct", "all"]).optional().default("all"),
  yearMin: z.coerce.number().int().optional(),
  yearMax: z.coerce.number().int().optional(),
  durationMin: z.coerce.number().int().optional(),
  durationMax: z.coerce.number().int().optional(),
  priceMin: z.coerce.number().int().optional(),
  priceMax: z.coerce.number().int().optional(),
  priceCurrency: z.string().trim().min(3).max(3).optional(),
  availableForTerritory: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional()
    .default(true),
});

// ─── Page Component ───────────────────────────────────────────────────────────

interface CatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  // Get session + active account
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const cookieStore = await cookies();
  const activeAccountCookie = cookieStore.get(ACTIVE_ACCOUNT_COOKIE);

  if (!activeAccountCookie) {
    throw new Error("No active account");
  }

  const parsed = parseActiveAccountCookie(activeAccountCookie.value);
  if (!parsed) {
    throw new Error("Invalid active account cookie");
  }

  const accountId = parsed.accountId;

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, accountId),
    columns: { preferredCurrency: true },
  });

  const preferredCurrency = (account?.preferredCurrency ?? "EUR").toUpperCase();

  // Parse search params
  const rawParams = await searchParams;
  const validationResult = catalogSearchParamsSchema.safeParse(rawParams);

  if (!validationResult.success) {
    // Fallback to defaults on invalid params
    console.error("Invalid catalog search params:", validationResult.error);
  }

  const params = validationResult.success
    ? validationResult.data
    : catalogSearchParamsSchema.parse({});

  // Normalize array params
  const filters = {
    search: params.search,
    directors: Array.isArray(params.directors)
      ? params.directors
      : params.directors
        ? [params.directors]
        : [],
    cast: Array.isArray(params.cast) ? params.cast : params.cast ? [params.cast] : [],
    genres: Array.isArray(params.genres) ? params.genres : params.genres ? [params.genres] : [],
    countries: Array.isArray(params.countries)
      ? params.countries
      : params.countries
        ? [params.countries]
        : [],
    rightsHolderIds: Array.isArray(params.rightsHolderIds)
      ? params.rightsHolderIds
      : params.rightsHolderIds
        ? [params.rightsHolderIds]
        : [],
    companies: Array.isArray(params.companies)
      ? params.companies
      : params.companies
        ? [params.companies]
        : [],
    type: params.type,
    yearMin: params.yearMin,
    yearMax: params.yearMax,
    durationMin: params.durationMin,
    durationMax: params.durationMax,
    priceMin: params.priceMin,
    priceMax: params.priceMax,
    priceCurrency: (params.priceCurrency ?? preferredCurrency).toUpperCase(),
    availableForTerritory: params.availableForTerritory,
  };

  const pagination = { page: params.page, limit: params.limit };
  const sort = { field: params.sort, order: params.order };

  // Fetch catalog data + filter options (server-side)
  const [catalogResult, filterOptions] = await Promise.all([
    getCatalogForExhibitor(accountId, filters, pagination, sort),
    getCatalogFilterOptions(accountId, filters),
  ]);

  return (
    <CatalogPageContent
      initialFilms={catalogResult.films}
      initialTotal={catalogResult.total}
      initialPage={catalogResult.page}
      initialLimit={catalogResult.limit}
      genreOptions={filterOptions.genres}
      directorOptions={filterOptions.directors}
      actorOptions={filterOptions.actors}
      companyOptions={filterOptions.companies}
      totalPlatformFilms={filterOptions.totalFilms}
      releaseYearRange={filterOptions.releaseYearRange}
      durationRange={filterOptions.durationRange}
      unitPriceRange={filterOptions.unitPriceRange}
      priceCurrencyExcludedCount={filterOptions.priceCurrencyExcludedCount}
      defaultPriceCurrency={preferredCurrency}
    />
  );
}
