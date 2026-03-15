import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { films } from "./films";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const editorialSectionTypeEnum = pgEnum("editorial_section_type", [
  "slideshow",
  "collection",
  "card_grid",
  "decade_catalog",
]);

// ─── Editorial Sections ───────────────────────────────────────────────────────
// Ordered blocks on the exhibitor home page, managed by admins.

export const editorialSections = pgTable(
  "editorial_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: editorialSectionTypeEnum("type").notNull(),
    title: text("title"),
    titleFr: text("title_fr"),
    position: integer("position").notNull().default(0),
    visible: boolean("visible").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("editorial_sections_position_idx").on(table.position)]
);

// ─── Slideshow Items ──────────────────────────────────────────────────────────
// Films featured in the hero carousel.

export const slideshowItems = pgTable(
  "slideshow_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => editorialSections.id, { onDelete: "cascade" }),
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id, { onDelete: "cascade" }),
    headline: text("headline"),
    headlineFr: text("headline_fr"),
    subtitle: text("subtitle"),
    subtitleFr: text("subtitle_fr"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("slideshow_items_section_position_idx").on(table.sectionId, table.position)]
);

// ─── Collections ──────────────────────────────────────────────────────────────
// Curated playlists of films, each accessible at /playlist/{slug}.

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => editorialSections.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    titleFr: text("title_fr"),
    description: text("description"),
    descriptionFr: text("description_fr"),
    coverUrl: text("cover_url"),
    visible: boolean("visible").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("collections_slug_idx").on(table.slug)]
);

// ─── Collection Films ─────────────────────────────────────────────────────────
// Ordered films within a collection.

export const collectionFilms = pgTable(
  "collection_films",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("collection_films_collection_position_idx").on(table.collectionId, table.position),
  ]
);

// ─── Editorial Cards ──────────────────────────────────────────────────────────
// Visual clickable cards linking to filtered catalog or external URLs.

export const editorialCards = pgTable(
  "editorial_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => editorialSections.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    titleFr: text("title_fr"),
    description: text("description"),
    descriptionFr: text("description_fr"),
    imageUrl: text("image_url").notNull(),
    href: text("href").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("editorial_cards_section_position_idx").on(table.sectionId, table.position)]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const editorialSectionsRelations = relations(editorialSections, ({ many }) => ({
  slideshowItems: many(slideshowItems),
  collections: many(collections),
  editorialCards: many(editorialCards),
}));

export const slideshowItemsRelations = relations(slideshowItems, ({ one }) => ({
  section: one(editorialSections, {
    fields: [slideshowItems.sectionId],
    references: [editorialSections.id],
  }),
  film: one(films, {
    fields: [slideshowItems.filmId],
    references: [films.id],
  }),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  section: one(editorialSections, {
    fields: [collections.sectionId],
    references: [editorialSections.id],
  }),
  collectionFilms: many(collectionFilms),
}));

export const collectionFilmsRelations = relations(collectionFilms, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionFilms.collectionId],
    references: [collections.id],
  }),
  film: one(films, {
    fields: [collectionFilms.filmId],
    references: [films.id],
  }),
}));

export const editorialCardsRelations = relations(editorialCards, ({ one }) => ({
  section: one(editorialSections, {
    fields: [editorialCards.sectionId],
    references: [editorialSections.id],
  }),
}));
