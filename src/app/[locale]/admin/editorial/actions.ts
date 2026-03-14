"use server";

import { getCurrentMembership } from "@/lib/auth/membership";
import {
  addEditorialCard,
  addFilmToCollection,
  addSlideshowItem,
  createSection,
  deleteEditorialCard,
  deleteSection,
  deleteSlideshowItem,
  getAllSections,
  getCollectionForAdmin,
  getEditorialCardsForAdmin,
  getSlideshowItemsForAdmin,
  removeFilmFromCollection,
  reorderCollectionFilms,
  reorderEditorialCards,
  reorderSections,
  reorderSlideshowItems,
  searchActiveFilms,
  updateCollection,
  updateEditorialCard,
  updateSection,
  updateSlideshowItem,
} from "@/lib/services/editorial-service";

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function requireAdmin() {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };
  return { success: true as const };
}

// ─── Sections ─────────────────────────────────────────────────────────────────

export async function getSectionsAction() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const sections = await getAllSections();
  return { sections };
}

export async function createSectionAction(input: {
  type: "slideshow" | "collection" | "card_grid" | "decade_catalog";
  title?: string;
}) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const section = await createSection(input);
  return { success: true as const, section };
}

export async function updateSectionAction(
  sectionId: string,
  input: { title?: string | null; titleFr?: string | null; visible?: boolean }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await updateSection(sectionId, input);
  return { success: true as const };
}

export async function deleteSectionAction(sectionId: string) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await deleteSection(sectionId);
  return { success: true as const };
}

export async function reorderSectionsAction(sectionIds: string[]) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await reorderSections(sectionIds);
  return { success: true as const };
}

// ─── Slideshow ────────────────────────────────────────────────────────────────

export async function getSlideshowItemsAction(sectionId: string) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const items = await getSlideshowItemsForAdmin(sectionId);
  return { items };
}

export async function addSlideshowItemAction(input: {
  sectionId: string;
  filmId: string;
  headline?: string;
  headlineFr?: string;
  subtitle?: string;
  subtitleFr?: string;
}) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await addSlideshowItem(input);
  return { success: true as const };
}

export async function updateSlideshowItemAction(
  itemId: string,
  input: {
    headline?: string | null;
    headlineFr?: string | null;
    subtitle?: string | null;
    subtitleFr?: string | null;
  }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await updateSlideshowItem(itemId, input);
  return { success: true as const };
}

export async function deleteSlideshowItemAction(itemId: string) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await deleteSlideshowItem(itemId);
  return { success: true as const };
}

export async function reorderSlideshowItemsAction(itemIds: string[]) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await reorderSlideshowItems(itemIds);
  return { success: true as const };
}

// ─── Collections ──────────────────────────────────────────────────────────────

export async function getCollectionAction(sectionId: string) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const collection = await getCollectionForAdmin(sectionId);
  return { collection: collection ?? null };
}

export async function updateCollectionAction(
  collectionId: string,
  input: {
    title?: string;
    titleFr?: string | null;
    slug?: string;
    description?: string | null;
    descriptionFr?: string | null;
    coverUrl?: string | null;
    visible?: boolean;
  }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await updateCollection(collectionId, input);
  return { success: true as const };
}

export async function addFilmToCollectionAction(input: { collectionId: string; filmId: string }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await addFilmToCollection(input);
  return { success: true as const };
}

export async function removeFilmFromCollectionAction(collectionFilmId: string) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await removeFilmFromCollection(collectionFilmId);
  return { success: true as const };
}

export async function reorderCollectionFilmsAction(filmIds: string[]) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await reorderCollectionFilms(filmIds);
  return { success: true as const };
}

// ─── Editorial cards ──────────────────────────────────────────────────────────

export async function getEditorialCardsAction(sectionId: string) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const cards = await getEditorialCardsForAdmin(sectionId);
  return { cards };
}

export async function addEditorialCardAction(input: {
  sectionId: string;
  title: string;
  titleFr?: string;
  imageUrl: string;
  href: string;
}) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await addEditorialCard(input);
  return { success: true as const };
}

export async function updateEditorialCardAction(
  cardId: string,
  input: { title?: string; titleFr?: string | null; imageUrl?: string; href?: string }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await updateEditorialCard(cardId, input);
  return { success: true as const };
}

export async function deleteEditorialCardAction(cardId: string) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await deleteEditorialCard(cardId);
  return { success: true as const };
}

export async function reorderEditorialCardsAction(cardIds: string[]) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  await reorderEditorialCards(cardIds);
  return { success: true as const };
}

// ─── Film search ──────────────────────────────────────────────────────────────

export async function searchFilmsAction(query: string) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  const films = await searchActiveFilms(query);
  return { films };
}
