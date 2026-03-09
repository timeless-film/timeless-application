import { index, pgTable, text, timestamp, uuid, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";

import { accounts } from "./accounts";
import { films } from "./films";

// ─── Film Events (views, cart additions) ──────────────────────────────────────

export const filmEventTypeEnum = pgEnum("film_event_type", ["view", "cart_add"]);

export const filmEvents = pgTable(
  "film_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filmId: uuid("film_id")
      .notNull()
      .references(() => films.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    eventType: filmEventTypeEnum("event_type").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("film_events_film_id_idx").on(table.filmId),
    index("film_events_account_id_idx").on(table.accountId),
    index("film_events_type_idx").on(table.eventType),
    index("film_events_created_at_idx").on(table.createdAt),
  ]
);

// ─── Search Events (tracking exhibitor searches) ─────────────────────────────

export const searchEvents = pgTable(
  "search_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    searchTerm: text("search_term"),
    filters: jsonb("filters"), // Active filters as JSON snapshot
    resultCount: integer("result_count"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("search_events_account_id_idx").on(table.accountId),
    index("search_events_created_at_idx").on(table.createdAt),
  ]
);
