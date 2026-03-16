import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { films } from "./films";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const filmPersonRoleEnum = pgEnum("film_person_role", [
  "director",
  "actor",
  "producer",
  "executive_producer",
  "composer",
  "cinematographer",
  "screenplay",
]);

// ─── Genres (taxonomy) ────────────────────────────────────────────────────────

export const genres = pgTable(
  "genres",
  {
    id: serial("id").primaryKey(),
    tmdbId: integer("tmdb_id"),
    nameEn: text("name_en").notNull(),
    nameFr: text("name_fr").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("genres_tmdb_id_idx").on(table.tmdbId)]
);

// ─── Film ↔ Genre (many-to-many) ──────────────────────────────────────────────

export const filmGenres = pgTable(
  "film_genres",
  {
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id, { onDelete: "cascade" }),
    genreId: integer("genre_id")
      .notNull()
      .references(() => genres.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.filmId, table.genreId] }),
    index("film_genres_film_id_idx").on(table.filmId),
    index("film_genres_genre_id_idx").on(table.genreId),
  ]
);

// ─── Film People (cast & crew) ────────────────────────────────────────────────

export const filmPeople = pgTable(
  "film_people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id, { onDelete: "cascade" }),
    tmdbPersonId: integer("tmdb_person_id"),
    name: text("name").notNull(),
    role: filmPersonRoleEnum("role").notNull(),
    character: text("character"), // Character name (actors only)
    displayOrder: integer("display_order").notNull().default(0),
    profileUrl: text("profile_url"), // TMDB profile photo URL
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("film_people_film_id_idx").on(table.filmId),
    index("film_people_role_idx").on(table.filmId, table.role),
    index("film_people_name_idx").on(table.name),
  ]
);

// ─── Film Companies (production companies) ────────────────────────────────────

export const filmCompanies = pgTable(
  "film_companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id, { onDelete: "cascade" }),
    tmdbCompanyId: integer("tmdb_company_id"),
    name: text("name").notNull(),
    logoUrl: text("logo_url"),
    originCountry: text("origin_country"), // ISO 3166-1 alpha-2
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("film_companies_film_id_idx").on(table.filmId),
    index("film_companies_name_idx").on(table.name),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const genresRelations = relations(genres, ({ many }) => ({
  filmGenres: many(filmGenres),
}));

export const filmGenresRelations = relations(filmGenres, ({ one }) => ({
  film: one(films, {
    fields: [filmGenres.filmId],
    references: [films.id],
  }),
  genre: one(genres, {
    fields: [filmGenres.genreId],
    references: [genres.id],
  }),
}));

export const filmPeopleRelations = relations(filmPeople, ({ one }) => ({
  film: one(films, {
    fields: [filmPeople.filmId],
    references: [films.id],
  }),
}));

export const filmCompaniesRelations = relations(filmCompanies, ({ one }) => ({
  film: one(films, {
    fields: [filmCompanies.filmId],
    references: [films.id],
  }),
}));
