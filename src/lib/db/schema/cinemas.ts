import { relations } from "drizzle-orm";
import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { accounts } from "./accounts";

export const projectionTypeEnum = pgEnum("projection_type", ["digital", "film_35mm", "film_70mm"]);

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
  archivedAt: timestamp("archived_at"),
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
  capacity: integer("capacity").notNull(),
  reference: text("reference"),
  projectionType: projectionTypeEnum("projection_type"),
  hasDcpEquipment: boolean("has_dcp_equipment").notNull().default(false),
  screenFormat: text("screen_format"),
  soundSystem: text("sound_system"),
  archivedAt: timestamp("archived_at"),
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
