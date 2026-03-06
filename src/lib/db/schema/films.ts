import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./accounts";

export const filmStatusEnum = pgEnum("film_status", [
  "active",
  "inactive",
  "retired",
]);

export const filmTypeEnum = pgEnum("film_type", [
  "direct",      // Achat direct, pas de validation requise
  "validation",  // Validation requise par l'ayant droit
]);

export const tmdbMatchStatusEnum = pgEnum("tmdb_match_status", [
  "matched",      // Match trouvé et confirmé
  "pending",      // En attente de review manuelle
  "no_match",     // Aucun match TMDB
  "manual",       // Données saisies manuellement (TMDB ignoré)
]);

// ─── Films ───────────────────────────────────────────────────────────────────
export const films = pgTable("films", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id") // Ayant droit propriétaire
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),

  // Identité
  title: text("title").notNull(),
  originalTitle: text("original_title"),
  status: filmStatusEnum("status").notNull().default("active"),
  type: filmTypeEnum("type").notNull().default("direct"),

  // TMDB
  tmdbId: integer("tmdb_id"),
  tmdbMatchStatus: tmdbMatchStatusEnum("tmdb_match_status").default("pending"),
  tmdbData: jsonb("tmdb_data"), // Snapshot des données TMDB
  // Champs dénormalisés depuis TMDB pour la recherche
  synopsis: text("synopsis"),
  synopsisEn: text("synopsis_en"),
  duration: integer("duration"), // En minutes
  releaseYear: integer("release_year"),
  genres: text("genres").array(),
  directors: text("directors").array(),
  cast: text("cast").array(),       // Acteurs principaux
  countries: text("countries").array(), // Pays d'origine/tournage
  posterUrl: text("poster_url"),
  backdropUrl: text("backdrop_url"),
  tmdbRating: text("tmdb_rating"),  // Stocké en string pour éviter float issues

  // Source de l'ajout
  importSource: text("import_source").default("manual"), // "manual" | "csv"
  importBatchId: text("import_batch_id"), // ID du batch d'import CSV

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Prix par zone géographique ───────────────────────────────────────────────
export const filmPrices = pgTable("film_prices", {
  id: uuid("id").primaryKey().defaultRandom(),
  filmId: uuid("film_id")
    .notNull()
    .references(() => films.id, { onDelete: "cascade" }),
  countries: text("countries").array().notNull(), // Ex: ["FR", "BE", "CH"]
  price: integer("price").notNull(),              // En centimes (ex: 15000 = 150.00)
  currency: text("currency").notNull(),            // Code ISO: "EUR", "USD", etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
