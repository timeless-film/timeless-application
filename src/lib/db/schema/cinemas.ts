import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

import { accounts } from "./accounts";

// ─── Cinemas ──────────────────────────────────────────────────────────────────
export const cinemas = pgTable("cinemas", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  country: text("country").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Rooms ────────────────────────────────────────────────────────────────────
export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  cinemaId: uuid("cinema_id")
    .notNull()
    .references(() => cinemas.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(), // Seating capacity
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const cinemasRelations = relations(cinemas, ({ one, many }) => ({
  account: one(accounts, {
    fields: [cinemas.accountId],
    references: [accounts.id],
  }),
  rooms: many(rooms),
}));

export const roomsRelations = relations(rooms, ({ one }) => ({
  cinema: one(cinemas, {
    fields: [rooms.cinemaId],
    references: [cinemas.id],
  }),
}));
