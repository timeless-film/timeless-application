import { relations, sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

import { accounts } from "./accounts";

export const filmStatusEnum = pgEnum("film_status", ["active", "inactive", "retired"]);

export const filmTypeEnum = pgEnum("film_type", [
  "direct", // Direct purchase, no validation required
  "validation", // Validation required by rights holder
]);

export const tmdbMatchStatusEnum = pgEnum("tmdb_match_status", [
  "matched", // Match found and confirmed
  "pending", // Awaiting manual review
  "no_match", // No TMDB match found
  "manual", // Manually entered data (TMDB ignored)
]);

// ─── Films ────────────────────────────────────────────────────────────────────
export const films = pgTable(
  "films",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id") // Rights holder owner
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),

    // Identity
    title: text("title").notNull(),
    originalTitle: text("original_title"),
    externalId: text("external_id"), // Rights holder's own catalogue code (EAN, internal ref, etc.)
    status: filmStatusEnum("status").notNull().default("active"),
    type: filmTypeEnum("type").notNull().default("direct"),

    // TMDB
    tmdbId: integer("tmdb_id"),
    tmdbMatchStatus: tmdbMatchStatusEnum("tmdb_match_status").default("pending"),
    tmdbData: jsonb("tmdb_data"), // TMDB data snapshot
    // Denormalized TMDB fields for search
    synopsis: text("synopsis"),
    synopsisEn: text("synopsis_en"),
    duration: integer("duration"), // In minutes
    releaseYear: integer("release_year"),
    genres: text("genres").array(),
    directors: text("directors").array(),
    cast: text("cast").array(), // Top billed cast
    countries: text("countries").array(), // Production countries
    posterUrl: text("poster_url"),
    backdropUrl: text("backdrop_url"),
    tmdbRating: text("tmdb_rating"), // Stored as string to avoid float issues

    // Import source
    importSource: text("import_source").default("manual"), // "manual" | "csv" | "excel"
    importBatchId: text("import_batch_id"), // Import batch ID

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("films_account_external_id_idx")
      .on(table.accountId, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    // Performance indexes for catalog queries
    index("films_status_idx").on(table.status),
    index("films_type_idx").on(table.type),
    index("films_release_year_idx").on(table.releaseYear),
    index("films_title_idx").on(table.title),
    // Composite index for common catalog filters (status + type + year)
    index("films_catalog_query_idx").on(table.status, table.type, table.releaseYear),
  ]
);

// ─── Prices by geographic zone ────────────────────────────────────────────────
export const filmPrices = pgTable(
  "film_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id, { onDelete: "cascade" }),
    countries: text("countries").array().notNull(), // e.g. ["FR", "BE", "CH"]
    price: integer("price").notNull(), // In cents (e.g. 15000 = 150.00)
    currency: text("currency").notNull(), // ISO code: "EUR", "USD", etc.
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // GIN index for array containment queries (territory availability)
    index("film_prices_countries_idx").using("gin", table.countries),
    index("film_prices_film_id_idx").on(table.filmId),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────
export const filmsRelations = relations(films, ({ one, many }) => ({
  account: one(accounts, {
    fields: [films.accountId],
    references: [accounts.id],
  }),
  prices: many(filmPrices),
}));

export const filmPricesRelations = relations(filmPrices, ({ one }) => ({
  film: one(films, {
    fields: [filmPrices.filmId],
    references: [films.id],
  }),
}));
