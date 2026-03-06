import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const accountTypeEnum = pgEnum("account_type", [
  "exploitant",
  "ayant_droit",
  "admin",
]);

export const accountStatusEnum = pgEnum("account_status", [
  "active",
  "suspended",
]);

export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "admin",
  "member",
]);

// ─── Comptes (entités juridiques) ───────────────────────────────────────────
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: accountTypeEnum("type").notNull(),
  status: accountStatusEnum("status").notNull().default("active"),

  // Informations légales
  companyName: text("company_name").notNull(),
  country: text("country").notNull(), // Code ISO 2 lettres
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  vatNumber: text("vat_number"),
  vatValidated: boolean("vat_validated").default(false),

  // Stripe
  stripeCustomerId: text("stripe_customer_id"),
  stripeConnectAccountId: text("stripe_connect_account_id"), // Ayants droits uniquement
  stripeConnectOnboardingComplete: boolean(
    "stripe_connect_onboarding_complete"
  ).default(false),

  // Préférences (exploitants)
  preferredCurrency: text("preferred_currency").default("EUR"),

  // Ayants droits — commission spécifique (override du défaut global)
  commissionRate: text("commission_rate"), // stocké en décimal ex: "0.10" = 10%

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Utilisateurs ────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  emailVerified: boolean("email_verified").default(false),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Membres (liaison user <> account avec rôle) ─────────────────────────────
export const accountMembers = pgTable("account_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: memberRoleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Invitations ─────────────────────────────────────────────────────────────
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
  invitedByUserId: uuid("invited_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Relations ───────────────────────────────────────────────────────────────
export const accountsRelations = relations(accounts, ({ many }) => ({
  members: many(accountMembers),
  invitations: many(invitations),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(accountMembers),
}));

export const accountMembersRelations = relations(accountMembers, ({ one }) => ({
  account: one(accounts, {
    fields: [accountMembers.accountId],
    references: [accounts.id],
  }),
  user: one(users, {
    fields: [accountMembers.userId],
    references: [users.id],
  }),
}));
