import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  collectionFilms,
  collections,
  editorialCards,
  editorialSections,
  slideshowItems,
  films,
} from "@/lib/db/schema";
import { getLocalizedGenresForFilms } from "@/lib/services/film-service";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EditorialSectionRow {
  id: string;
  type: "slideshow" | "collection" | "card_grid" | "decade_catalog";
  title: string | null;
  titleFr: string | null;
  position: number;
  visible: boolean;
  config: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlideshowItemRow {
  id: string;
  sectionId: string;
  filmId: string;
  headline: string | null;
  subtitle: string | null;
  position: number;
  film: {
    id: string;
    title: string;
    posterUrl: string | null;
    backdropUrl: string | null;
    genres: { nameEn: string; nameFr: string }[];
    releaseYear: number | null;
    directors: string[] | null;
  };
}

export interface CollectionRow {
  id: string;
  sectionId: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  displayMode: "poster" | "backdrop";
  visible: boolean;
  collectionFilms: {
    id: string;
    position: number;
    film: {
      id: string;
      title: string;
      posterUrl: string | null;
      backdropUrl: string | null;
      directors: string[] | null;
      genres: { nameEn: string; nameFr: string }[];
      releaseYear: number | null;
    };
  }[];
}

export interface EditorialCardRow {
  id: string;
  sectionId: string;
  title: string;
  description: string | null;
  imageUrl: string;
  href: string;
  position: number;
}

export interface DecadeGroup {
  decade: number;
  label: string;
  films: {
    id: string;
    title: string;
    posterUrl: string | null;
    genres: { nameEn: string; nameFr: string }[];
    releaseYear: number | null;
  }[];
}

// ─── Locale helper ────────────────────────────────────────────────────────────

/** Pick the French value if locale is "fr" and the value exists, otherwise fall back to the default. */
function localized(
  defaultValue: string | null,
  frValue: string | null | undefined,
  locale: string
): string | null {
  if (locale === "fr" && frValue) return frValue;
  return defaultValue;
}

function localizedRequired(
  defaultValue: string,
  frValue: string | null | undefined,
  locale: string
): string {
  if (locale === "fr" && frValue) return frValue;
  return defaultValue;
}

// ─── Read operations (public) ─────────────────────────────────────────────────

export async function getVisibleSections(locale = "en"): Promise<EditorialSectionRow[]> {
  const rows = await db.query.editorialSections.findMany({
    where: eq(editorialSections.visible, true),
    orderBy: asc(editorialSections.position),
  });
  return rows.map((row) => ({
    ...row,
    title: localized(row.title, row.titleFr, locale),
  }));
}

export async function getSlideshowItems(
  sectionId: string,
  locale = "en"
): Promise<SlideshowItemRow[]> {
  const items = await db.query.slideshowItems.findMany({
    where: eq(slideshowItems.sectionId, sectionId),
    orderBy: asc(slideshowItems.position),
    with: {
      film: {
        columns: {
          id: true,
          title: true,
          posterUrl: true,
          backdropUrl: true,
          releaseYear: true,
          directors: true,
          status: true,
        },
      },
    },
  });
  const activeItems = items.filter((item) => item.film.status === "active");
  const filmIds = activeItems.map((item) => item.film.id);
  const genresMap = await getLocalizedGenresForFilms(filmIds);
  return activeItems.map((item) => ({
    id: item.id,
    sectionId: item.sectionId,
    filmId: item.filmId,
    headline: localized(item.headline, item.headlineFr, locale),
    subtitle: localized(item.subtitle, item.subtitleFr, locale),
    position: item.position,
    film: {
      ...item.film,
      genres: genresMap.get(item.film.id) ?? [],
    },
  }));
}

export async function getCollectionsForSection(
  sectionId: string,
  locale = "en"
): Promise<CollectionRow[]> {
  const result = await db.query.collections.findMany({
    where: and(eq(collections.sectionId, sectionId), eq(collections.visible, true)),
    with: {
      collectionFilms: {
        orderBy: asc(collectionFilms.position),
        with: {
          film: {
            columns: {
              id: true,
              title: true,
              posterUrl: true,
              backdropUrl: true,
              directors: true,
              releaseYear: true,
              status: true,
            },
          },
        },
      },
    },
  });
  const allFilmIds = result.flatMap((col) =>
    col.collectionFilms.filter((cf) => cf.film.status === "active").map((cf) => cf.film.id)
  );
  const genresMap = await getLocalizedGenresForFilms(allFilmIds);
  return result.map((col) => ({
    ...col,
    title: localizedRequired(col.title, col.titleFr, locale),
    description: localized(col.description, col.descriptionFr, locale),
    displayMode: (col.displayMode === "backdrop"
      ? "backdrop"
      : "poster") as CollectionRow["displayMode"],
    collectionFilms: col.collectionFilms
      .filter((cf) => cf.film.status === "active")
      .map((cf) => ({
        ...cf,
        film: { ...cf.film, genres: genresMap.get(cf.film.id) ?? [] },
      })) as CollectionRow["collectionFilms"],
  }));
}

export async function getCollectionBySlug(slug: string, locale = "en") {
  const collection = await db.query.collections.findFirst({
    where: and(eq(collections.slug, slug), eq(collections.visible, true)),
    with: {
      collectionFilms: {
        orderBy: asc(collectionFilms.position),
        with: {
          film: {
            columns: {
              id: true,
              title: true,
              posterUrl: true,
              releaseYear: true,
              directors: true,
              synopsis: true,
              backdropUrl: true,
              duration: true,
              status: true,
            },
          },
        },
      },
    },
  });
  if (!collection) return null;
  const activeFilms = collection.collectionFilms.filter((cf) => cf.film.status === "active");
  const filmIds = activeFilms.map((cf) => cf.film.id);
  const genresMap = await getLocalizedGenresForFilms(filmIds);
  return {
    ...collection,
    title: localizedRequired(collection.title, collection.titleFr, locale),
    description: localized(collection.description, collection.descriptionFr, locale),
    collectionFilms: activeFilms.map((cf) => ({
      ...cf,
      film: { ...cf.film, genres: genresMap.get(cf.film.id) ?? [] },
    })),
  };
}

export async function getEditorialCards(
  sectionId: string,
  locale = "en"
): Promise<EditorialCardRow[]> {
  const cards = await db.query.editorialCards.findMany({
    where: eq(editorialCards.sectionId, sectionId),
    orderBy: asc(editorialCards.position),
  });
  return cards.map((card) => ({
    id: card.id,
    sectionId: card.sectionId,
    title: localizedRequired(card.title, card.titleFr, locale),
    description: localized(card.description, card.descriptionFr, locale),
    imageUrl: card.imageUrl,
    href: localized(card.href, card.hrefFr, locale) ?? card.href,
    position: card.position,
  }));
}

export async function getFilmsByDecade(
  limit = 20,
  selectedDecades?: number[]
): Promise<DecadeGroup[]> {
  // Get all active films with a release year, ordered by creation date
  const activeFilms = await db.query.films.findMany({
    where: and(eq(films.status, "active"), sql`${films.releaseYear} IS NOT NULL`),
    columns: {
      id: true,
      title: true,
      posterUrl: true,
      releaseYear: true,
      createdAt: true,
    },
    orderBy: desc(films.createdAt),
  });

  // Group by decade
  const decadeMap = new Map<
    number,
    { id: string; title: string; posterUrl: string | null; releaseYear: number | null }[]
  >();
  for (const film of activeFilms) {
    if (!film.releaseYear) continue;
    const decade = Math.floor(film.releaseYear / 10) * 10;
    const existing = decadeMap.get(decade) ?? [];
    if (existing.length < limit) {
      existing.push({
        id: film.id,
        title: film.title,
        posterUrl: film.posterUrl,
        releaseYear: film.releaseYear,
      });
    }
    decadeMap.set(decade, existing);
  }

  // Fetch genres for all films in the result
  const allFilmIds = Array.from(decadeMap.values()).flatMap((f) => f.map((film) => film.id));
  const genresMap = await getLocalizedGenresForFilms(allFilmIds);

  // Sort decades from most recent to oldest
  const decades = Array.from(decadeMap.entries())
    .filter(
      ([decade]) =>
        !selectedDecades || selectedDecades.length === 0 || selectedDecades.includes(decade)
    )
    .sort((a, b) => b[0] - a[0])
    .map(([decade, decadeFilms]) => ({
      decade,
      label: `${decade}s`,
      films: decadeFilms.map((f) => ({
        ...f,
        genres: genresMap.get(f.id) ?? [],
      })),
    }));

  return decades;
}

export function getAvailableDecades(): number[] {
  const currentDecade = Math.floor(new Date().getFullYear() / 10) * 10;
  const startDecade = 1890;
  const decades: number[] = [];
  for (let d = currentDecade; d >= startDecade; d -= 10) {
    decades.push(d);
  }
  return decades;
}

// ─── Admin operations ─────────────────────────────────────────────────────────

export async function getAllSections(): Promise<EditorialSectionRow[]> {
  return db.query.editorialSections.findMany({
    orderBy: asc(editorialSections.position),
  });
}

export async function createSection(input: {
  type: "slideshow" | "collection" | "card_grid" | "decade_catalog";
  title?: string;
}): Promise<EditorialSectionRow> {
  // Get next position
  const maxResult = await db
    .select({ maxPos: sql<number>`coalesce(max(${editorialSections.position}), -1)` })
    .from(editorialSections);
  const nextPosition = (maxResult[0]?.maxPos ?? -1) + 1;

  const [section] = await db
    .insert(editorialSections)
    .values({
      type: input.type,
      title: input.title ?? null,
      position: nextPosition,
      visible: true,
    })
    .returning();

  // If collection type, create a default collection
  if (input.type === "collection" && section) {
    await db.insert(collections).values({
      sectionId: section.id,
      slug: `collection-${Date.now()}`,
      title: input.title ?? "New collection",
      visible: true,
    });
  }

  return section!;
}

export async function updateSection(
  sectionId: string,
  input: { title?: string | null; titleFr?: string | null; visible?: boolean; config?: unknown }
): Promise<void> {
  await db
    .update(editorialSections)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(editorialSections.id, sectionId));
}

export async function deleteSection(sectionId: string): Promise<void> {
  await db.delete(editorialSections).where(eq(editorialSections.id, sectionId));
}

export async function reorderSections(sectionIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (let i = 0; i < sectionIds.length; i++) {
      await tx
        .update(editorialSections)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(editorialSections.id, sectionIds[i]!));
    }
  });
}

// ─── Slideshow admin ──────────────────────────────────────────────────────────

export async function getSlideshowItemsForAdmin(sectionId: string) {
  const items = await db.query.slideshowItems.findMany({
    where: eq(slideshowItems.sectionId, sectionId),
    orderBy: asc(slideshowItems.position),
    with: {
      film: {
        columns: {
          id: true,
          title: true,
          posterUrl: true,
          backdropUrl: true,
          releaseYear: true,
          directors: true,
        },
      },
    },
  });
  const filmIds = items.map((item) => item.film.id);
  const genresMap = await getLocalizedGenresForFilms(filmIds);
  return items.map((item) => ({
    ...item,
    film: { ...item.film, genres: genresMap.get(item.film.id) ?? [] },
  }));
}

export async function addSlideshowItem(input: {
  sectionId: string;
  filmId: string;
  headline?: string;
  headlineFr?: string;
  subtitle?: string;
  subtitleFr?: string;
}): Promise<void> {
  const maxResult = await db
    .select({ maxPos: sql<number>`coalesce(max(${slideshowItems.position}), -1)` })
    .from(slideshowItems)
    .where(eq(slideshowItems.sectionId, input.sectionId));
  const nextPosition = (maxResult[0]?.maxPos ?? -1) + 1;

  await db.insert(slideshowItems).values({
    sectionId: input.sectionId,
    filmId: input.filmId,
    headline: input.headline ?? null,
    headlineFr: input.headlineFr ?? null,
    subtitle: input.subtitle ?? null,
    subtitleFr: input.subtitleFr ?? null,
    position: nextPosition,
  });
}

export async function updateSlideshowItem(
  itemId: string,
  input: {
    headline?: string | null;
    headlineFr?: string | null;
    subtitle?: string | null;
    subtitleFr?: string | null;
  }
): Promise<void> {
  await db
    .update(slideshowItems)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(slideshowItems.id, itemId));
}

export async function deleteSlideshowItem(itemId: string): Promise<void> {
  await db.delete(slideshowItems).where(eq(slideshowItems.id, itemId));
}

export async function reorderSlideshowItems(itemIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (let i = 0; i < itemIds.length; i++) {
      await tx
        .update(slideshowItems)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(slideshowItems.id, itemIds[i]!));
    }
  });
}

// ─── Collection admin ─────────────────────────────────────────────────────────

export async function getCollectionForAdmin(sectionId: string) {
  const collection = await db.query.collections.findFirst({
    where: eq(collections.sectionId, sectionId),
    with: {
      collectionFilms: {
        orderBy: asc(collectionFilms.position),
        with: {
          film: {
            columns: {
              id: true,
              title: true,
              posterUrl: true,
              releaseYear: true,
            },
          },
        },
      },
    },
  });
  if (!collection) return undefined;
  const filmIds = collection.collectionFilms.map((cf) => cf.film.id);
  const genresMap = await getLocalizedGenresForFilms(filmIds);
  return {
    ...collection,
    collectionFilms: collection.collectionFilms.map((cf) => ({
      ...cf,
      film: { ...cf.film, genres: genresMap.get(cf.film.id) ?? [] },
    })),
  };
}

export async function updateCollection(
  collectionId: string,
  input: {
    title?: string;
    titleFr?: string | null;
    slug?: string;
    description?: string | null;
    descriptionFr?: string | null;
    coverUrl?: string | null;
    displayMode?: string;
    visible?: boolean;
  }
): Promise<void> {
  await db
    .update(collections)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(collections.id, collectionId));
}

export async function addFilmToCollection(input: {
  collectionId: string;
  filmId: string;
}): Promise<void> {
  const maxResult = await db
    .select({ maxPos: sql<number>`coalesce(max(${collectionFilms.position}), -1)` })
    .from(collectionFilms)
    .where(eq(collectionFilms.collectionId, input.collectionId));
  const nextPosition = (maxResult[0]?.maxPos ?? -1) + 1;

  await db.insert(collectionFilms).values({
    collectionId: input.collectionId,
    filmId: input.filmId,
    position: nextPosition,
  });
}

export async function removeFilmFromCollection(collectionFilmId: string): Promise<void> {
  await db.delete(collectionFilms).where(eq(collectionFilms.id, collectionFilmId));
}

export async function reorderCollectionFilms(filmIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (let i = 0; i < filmIds.length; i++) {
      await tx
        .update(collectionFilms)
        .set({ position: i })
        .where(eq(collectionFilms.id, filmIds[i]!));
    }
  });
}

// ─── Editorial cards admin ────────────────────────────────────────────────────

export async function getEditorialCardsForAdmin(sectionId: string) {
  return db.query.editorialCards.findMany({
    where: eq(editorialCards.sectionId, sectionId),
    orderBy: asc(editorialCards.position),
  });
}

export async function addEditorialCard(input: {
  sectionId: string;
  title: string;
  titleFr?: string;
  description?: string;
  descriptionFr?: string;
  imageUrl: string;
  href: string;
  hrefFr?: string;
}): Promise<void> {
  const maxResult = await db
    .select({ maxPos: sql<number>`coalesce(max(${editorialCards.position}), -1)` })
    .from(editorialCards)
    .where(eq(editorialCards.sectionId, input.sectionId));
  const nextPosition = (maxResult[0]?.maxPos ?? -1) + 1;

  await db.insert(editorialCards).values({
    sectionId: input.sectionId,
    title: input.title,
    titleFr: input.titleFr ?? null,
    description: input.description ?? null,
    descriptionFr: input.descriptionFr ?? null,
    imageUrl: input.imageUrl,
    href: input.href,
    hrefFr: input.hrefFr ?? null,
    position: nextPosition,
  });
}

export async function updateEditorialCard(
  cardId: string,
  input: {
    title?: string;
    titleFr?: string | null;
    description?: string | null;
    descriptionFr?: string | null;
    imageUrl?: string;
    href?: string;
    hrefFr?: string | null;
  }
): Promise<void> {
  await db
    .update(editorialCards)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(editorialCards.id, cardId));
}

export async function deleteEditorialCard(cardId: string): Promise<void> {
  await db.delete(editorialCards).where(eq(editorialCards.id, cardId));
}

export async function reorderEditorialCards(cardIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (let i = 0; i < cardIds.length; i++) {
      await tx
        .update(editorialCards)
        .set({ position: i, updatedAt: new Date() })
        .where(eq(editorialCards.id, cardIds[i]!));
    }
  });
}

// ─── Film search (for admin pickers) ──────────────────────────────────────────

export async function searchActiveFilms(query: string, limit = 20) {
  const results = await db.query.films.findMany({
    where: and(eq(films.status, "active"), sql`${films.title} ILIKE ${`%${query}%`}`),
    columns: {
      id: true,
      title: true,
      posterUrl: true,
      backdropUrl: true,
      releaseYear: true,
      directors: true,
    },
    orderBy: asc(films.title),
    limit,
  });
  const filmIds = results.map((f) => f.id);
  const genresMap = await getLocalizedGenresForFilms(filmIds);
  return results.map((f) => ({
    ...f,
    genres: genresMap.get(f.id) ?? [],
  }));
}
