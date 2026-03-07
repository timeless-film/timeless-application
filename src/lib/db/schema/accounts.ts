import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, pgEnum, uuid, boolean } from "drizzle-orm/pg-core";

import { betterAuthUsers } from "./auth";

export const accountTypeEnum = pgEnum("account_type", ["exhibitor", "rights_holder", "admin"]);

export const accountStatusEnum = pgEnum("account_status", ["active", "suspended"]);

export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member"]);

// ─── Accounts (legal entities) ───────────────────────────────────────────────
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: accountTypeEnum("type").notNull(),
  status: accountStatusEnum("status").notNull().default("active"),

  // Legal information
  companyName: text("company_name").notNull(),
  country: text("country").notNull(), // ISO 2-letter code
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  vatNumber: text("vat_number"),
  vatValidated: boolean("vat_validated").default(false),

  // Stripe
  stripeCustomerId: text("stripe_customer_id"),
  stripeConnectAccountId: text("stripe_connect_account_id"), // Rights holders only
  stripeConnectOnboardingComplete: boolean("stripe_connect_onboarding_complete").default(false),

  // Preferences (exhibitors)
  preferredCurrency: text("preferred_currency").default("EUR"),

  // Rights holders — specific commission rate (overrides global default)
  commissionRate: text("commission_rate"), // Stored as decimal e.g. "0.10" = 10%

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Members (user <> account link with role) ─────────────────────────────────
export const accountMembers = pgTable("account_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => betterAuthUsers.id, { onDelete: "cascade" }),
  role: memberRoleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Invitations ──────────────────────────────────────────────────────────────
export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: memberRoleEnum("role").notNull().default("member"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  invitedByUserId: text("invited_by_user_id").references(() => betterAuthUsers.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────
export const accountsRelations = relations(accounts, ({ many }) => ({
  members: many(accountMembers),
  invitations: many(invitations),
}));

export const betterAuthUsersAccountRelations = relations(betterAuthUsers, ({ many }) => ({
  memberships: many(accountMembers),
}));

export const accountMembersRelations = relations(accountMembers, ({ one }) => ({
  account: one(accounts, {
    fields: [accountMembers.accountId],
    references: [accounts.id],
  }),
  user: one(betterAuthUsers, {
    fields: [accountMembers.userId],
    references: [betterAuthUsers.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  account: one(accounts, {
    fields: [invitations.accountId],
    references: [accounts.id],
  }),
}));
