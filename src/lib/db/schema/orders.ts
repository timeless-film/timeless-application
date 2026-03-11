import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, integer, pgEnum, date } from "drizzle-orm/pg-core";

import { accounts } from "./accounts";
import { betterAuthUsers } from "./auth";
import { cinemas, rooms } from "./cinemas";
import { films } from "./films";

export const requestStatusEnum = pgEnum("request_status", [
  "pending", // Awaiting validation by rights holder
  "approved", // Accepted, awaiting payment
  "rejected", // Rejected by rights holder
  "cancelled", // Cancelled by exhibitor
  "validated", // DEPRECATED - use approved
  "refused", // DEPRECATED - use rejected
  "expired", // DEPRECATED (E13 - auto expiration)
  "paid", // Paid
]);

export const orderStatusEnum = pgEnum("order_status", [
  "paid", // Payment received
  "processing", // Ops team handling delivery
  "delivered", // DCP/KDM delivered
  "refunded", // Refunded
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending", // To be handled by ops team
  "in_progress", // In progress (lab contacted)
  "delivered", // Delivered
]);

// ─── Requests (validation required) ──────────────────────────────────────────
export const requests = pgTable("requests", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Stakeholders
  exhibitorAccountId: uuid("exhibitor_account_id")
    .notNull()
    .references(() => accounts.id),
  rightsHolderAccountId: uuid("rights_holder_account_id")
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

  // Who created this request
  createdByUserId: text("created_by_user_id").references(() => betterAuthUsers.id),

  // Request details
  screeningCount: integer("screening_count").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  note: text("note"),

  // Price snapshotted at request time
  catalogPrice: integer("catalog_price").notNull(), // In cents (exhibitor's currency after conversion)
  currency: text("currency").notNull(), // Exhibitor's preferred currency
  platformMarginRate: text("platform_margin_rate").notNull(), // e.g. "0.20"
  deliveryFees: integer("delivery_fees").notNull(), // In cents
  commissionRate: text("commission_rate").notNull(), // e.g. "0.10"
  displayedPrice: integer("displayed_price").notNull(), // Price shown to exhibitor
  rightsHolderAmount: integer("rights_holder_amount").notNull(), // Amount received by rights holder
  timelessAmount: integer("timeless_amount").notNull(), // Amount retained by TIMELESS

  // Cross-currency conversion (null if same currency)
  originalCatalogPrice: integer("original_catalog_price"), // In cents, film's native currency
  originalCurrency: text("original_currency"), // Film's native currency code
  exchangeRate: text("exchange_rate"), // Rate applied (decimal string, e.g. "0.92")

  // Workflow
  status: requestStatusEnum("status").notNull().default("pending"),
  validationToken: text("validation_token"), // JWT token for accept/refuse from email
  refusalReason: text("refusal_reason"), // DEPRECATED - use rejectionReason
  rejectionReason: text("rejection_reason"),
  approvalNote: text("approval_note"),
  cancellationReason: text("cancellation_reason"),
  processedByUserId: text("processed_by_user_id").references(() => betterAuthUsers.id),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  cancelledAt: timestamp("cancelled_at"),
  validatedAt: timestamp("validated_at"), // DEPRECATED - use approvedAt
  refusedAt: timestamp("refused_at"), // DEPRECATED - use rejectedAt
  expiresAt: timestamp("expires_at"), // Future use (E13)

  // Payment (if validated → paid)
  stripePaymentLinkId: text("stripe_payment_link_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paidAt: timestamp("paid_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Orders (paid cart or paid request) ──────────────────────────────────────
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderNumber: integer("order_number").generatedAlwaysAsIdentity().notNull().unique(),
  exhibitorAccountId: uuid("exhibitor_account_id")
    .notNull()
    .references(() => accounts.id),

  status: orderStatusEnum("status").notNull().default("paid"),

  // Stripe
  stripePaymentIntentId: text("stripe_payment_intent_id").notNull(),
  stripeInvoiceId: text("stripe_invoice_id"),

  // Totals
  subtotal: integer("subtotal").notNull(), // In cents, excl. tax and delivery
  deliveryFeesTotal: integer("delivery_fees_total").notNull().default(0), // In cents, delivery fees × number of films
  taxAmount: integer("tax_amount").notNull(),
  total: integer("total").notNull(), // subtotal + deliveryFeesTotal + taxAmount
  currency: text("currency").notNull(),

  // VAT
  taxRate: text("tax_rate"),
  vatNumber: text("vat_number"), // VAT number snapshot at payment time
  reverseCharge: text("reverse_charge"), // "true" | "false"

  paidAt: timestamp("paid_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Order items ──────────────────────────────────────────────────────────────
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
  rightsHolderAccountId: uuid("rights_holder_account_id")
    .notNull()
    .references(() => accounts.id),

  // Screening details
  screeningCount: integer("screening_count").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),

  // Snapshotted prices
  catalogPrice: integer("catalog_price").notNull(), // In cents (exhibitor's currency after conversion)
  platformMarginRate: text("platform_margin_rate").notNull(),
  deliveryFees: integer("delivery_fees").notNull(),
  commissionRate: text("commission_rate").notNull(),
  displayedPrice: integer("displayed_price").notNull(),
  rightsHolderAmount: integer("rights_holder_amount").notNull(),
  timelessAmount: integer("timeless_amount").notNull(),
  currency: text("currency").notNull(), // Exhibitor's preferred currency

  // Cross-currency conversion (null if same currency)
  originalCatalogPrice: integer("original_catalog_price"), // In cents, film's native currency
  originalCurrency: text("original_currency"), // Film's native currency code
  exchangeRate: text("exchange_rate"), // Rate applied (decimal string)

  // Stripe Connect transfer
  stripeTransferId: text("stripe_transfer_id"),

  // Delivery
  deliveryStatus: deliveryStatusEnum("delivery_status").notNull().default("pending"),
  deliveryNotes: text("delivery_notes"),
  deliveredAt: timestamp("delivered_at"),

  // Link to validated request if applicable
  requestId: uuid("request_id").references(() => requests.id),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Cart (persistent) ────────────────────────────────────────────────────────
export const cartItems = pgTable("cart_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  exhibitorAccountId: uuid("exhibitor_account_id")
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
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const requestsRelations = relations(requests, ({ one }) => ({
  exhibitorAccount: one(accounts, {
    fields: [requests.exhibitorAccountId],
    references: [accounts.id],
    relationName: "exhibitor_requests",
  }),
  rightsHolderAccount: one(accounts, {
    fields: [requests.rightsHolderAccountId],
    references: [accounts.id],
    relationName: "rights_holder_requests",
  }),
  film: one(films, { fields: [requests.filmId], references: [films.id] }),
  cinema: one(cinemas, { fields: [requests.cinemaId], references: [cinemas.id] }),
  room: one(rooms, { fields: [requests.roomId], references: [rooms.id] }),
  createdByUser: one(betterAuthUsers, {
    fields: [requests.createdByUserId],
    references: [betterAuthUsers.id],
    relationName: "created_requests",
  }),
  processedByUser: one(betterAuthUsers, {
    fields: [requests.processedByUserId],
    references: [betterAuthUsers.id],
    relationName: "processed_requests",
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  exhibitorAccount: one(accounts, {
    fields: [orders.exhibitorAccountId],
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
  exhibitorAccount: one(accounts, {
    fields: [cartItems.exhibitorAccountId],
    references: [accounts.id],
  }),
  film: one(films, { fields: [cartItems.filmId], references: [films.id] }),
  cinema: one(cinemas, { fields: [cartItems.cinemaId], references: [cinemas.id] }),
  room: one(rooms, { fields: [cartItems.roomId], references: [rooms.id] }),
}));
