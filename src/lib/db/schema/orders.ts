import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  pgEnum,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./accounts";
import { films } from "./films";
import { cinemas, rooms } from "./cinemas";

export const requestStatusEnum = pgEnum("request_status", [
  "pending",    // En attente de validation par l'ayant droit
  "validated",  // Acceptée, en attente de paiement
  "refused",    // Refusée
  "expired",    // Expirée (30j ou 7j avant date de début)
  "paid",       // Payée
]);

export const orderStatusEnum = pgEnum("order_status", [
  "paid",         // Paiement reçu
  "processing",   // Ops en train de traiter la livraison
  "delivered",    // DCP/KDM livré
  "refunded",     // Remboursé
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",      // À traiter par l'équipe ops
  "in_progress",  // En cours (labo contacté)
  "delivered",    // Livré
]);

// ─── Demandes (validation requise) ────────────────────────────────────────────
export const requests = pgTable("requests", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Parties
  exploitantAccountId: uuid("exploitant_account_id")
    .notNull()
    .references(() => accounts.id),
  ayantDroitAccountId: uuid("ayant_droit_account_id")
    .notNull()
    .references(() => accounts.id),
  filmId: uuid("film_id")
    .notNull()
    .references(() => films.id),
  cinemaId: uuid("cinema_id")
    .notNull()
    .references(() => cinemas.id),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id),

  // Infos de la demande
  screeningCount: integer("screening_count").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),

  // Prix snapshoté au moment de la demande
  cataloguePrice: integer("catalogue_price").notNull(), // En centimes
  currency: text("currency").notNull(),
  platformMarginRate: text("platform_margin_rate").notNull(),  // Ex: "0.20"
  deliveryFees: integer("delivery_fees").notNull(),             // En centimes
  commissionRate: text("commission_rate").notNull(),            // Ex: "0.10"
  displayedPrice: integer("displayed_price").notNull(),         // Prix affiché à l'exploitant
  ayantDroitAmount: integer("ayant_droit_amount").notNull(),    // Ce que reçoit l'ayant droit
  timelessAmount: integer("timeless_amount").notNull(),          // Ce que garde TIMELESS

  // Workflow
  status: requestStatusEnum("status").notNull().default("pending"),
  validationToken: text("validation_token"),  // Token JWT pour accepter/refuser depuis email
  refusalReason: text("refusal_reason"),
  validatedAt: timestamp("validated_at"),
  refusedAt: timestamp("refused_at"),
  expiresAt: timestamp("expires_at").notNull(),

  // Paiement (si validée → payée)
  stripePaymentLinkId: text("stripe_payment_link_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paidAt: timestamp("paid_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Commandes (panier payé ou demande payée) ─────────────────────────────────
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  exploitantAccountId: uuid("exploitant_account_id")
    .notNull()
    .references(() => accounts.id),

  status: orderStatusEnum("status").notNull().default("paid"),

  // Stripe
  stripePaymentIntentId: text("stripe_payment_intent_id").notNull(),
  stripeInvoiceId: text("stripe_invoice_id"),

  // Totaux
  subtotal: integer("subtotal").notNull(),  // En centimes, HT
  taxAmount: integer("tax_amount").notNull(),
  total: integer("total").notNull(),
  currency: text("currency").notNull(),

  // TVA
  taxRate: text("tax_rate"),
  vatNumber: text("vat_number"),  // Snapshot du numéro TVA au moment du paiement
  reverseCharge: text("reverse_charge"),  // "true" | "false"

  paidAt: timestamp("paid_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Lignes de commande ────────────────────────────────────────────────────────
export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  filmId: uuid("film_id")
    .notNull()
    .references(() => films.id),
  cinemaId: uuid("cinema_id")
    .notNull()
    .references(() => cinemas.id),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id),
  ayantDroitAccountId: uuid("ayant_droit_account_id")
    .notNull()
    .references(() => accounts.id),

  // Infos de projection
  screeningCount: integer("screening_count").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),

  // Prix snapshotés
  cataloguePrice: integer("catalogue_price").notNull(),
  platformMarginRate: text("platform_margin_rate").notNull(),
  deliveryFees: integer("delivery_fees").notNull(),
  commissionRate: text("commission_rate").notNull(),
  displayedPrice: integer("displayed_price").notNull(),
  ayantDroitAmount: integer("ayant_droit_amount").notNull(),
  timelessAmount: integer("timeless_amount").notNull(),
  currency: text("currency").notNull(),

  // Stripe Connect transfer
  stripeTransferId: text("stripe_transfer_id"),

  // Livraison
  deliveryStatus: deliveryStatusEnum("delivery_status").notNull().default("pending"),
  deliveryNotes: text("delivery_notes"),
  deliveredAt: timestamp("delivered_at"),

  // Lien avec une demande validée si applicable
  requestId: uuid("request_id").references(() => requests.id),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Panier (persistant) ───────────────────────────────────────────────────────
export const cartItems = pgTable("cart_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  exploitantAccountId: uuid("exploitant_account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  filmId: uuid("film_id")
    .notNull()
    .references(() => films.id),
  cinemaId: uuid("cinema_id")
    .notNull()
    .references(() => cinemas.id),
  roomId: uuid("room_id")
    .notNull()
    .references(() => rooms.id),
  screeningCount: integer("screening_count").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const requestsRelations = relations(requests, ({ one }) => ({
  exploitantAccount: one(accounts, {
    fields: [requests.exploitantAccountId],
    references: [accounts.id],
    relationName: "exploitant_requests",
  }),
  ayantDroitAccount: one(accounts, {
    fields: [requests.ayantDroitAccountId],
    references: [accounts.id],
    relationName: "ayant_droit_requests",
  }),
  film: one(films, { fields: [requests.filmId], references: [films.id] }),
  cinema: one(cinemas, { fields: [requests.cinemaId], references: [cinemas.id] }),
  room: one(rooms, { fields: [requests.roomId], references: [rooms.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  exploitantAccount: one(accounts, {
    fields: [orders.exploitantAccountId],
    references: [accounts.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  film: one(films, { fields: [orderItems.filmId], references: [films.id] }),
  cinema: one(cinemas, { fields: [orderItems.cinemaId], references: [cinemas.id] }),
  room: one(rooms, { fields: [orderItems.roomId], references: [rooms.id] }),
  request: one(requests, { fields: [orderItems.requestId], references: [requests.id] }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  exploitantAccount: one(accounts, {
    fields: [cartItems.exploitantAccountId],
    references: [accounts.id],
  }),
  film: one(films, { fields: [cartItems.filmId], references: [films.id] }),
  cinema: one(cinemas, { fields: [cartItems.cinemaId], references: [cinemas.id] }),
  room: one(rooms, { fields: [cartItems.roomId], references: [rooms.id] }),
}));
