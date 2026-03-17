import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { accounts } from "./accounts";
import { betterAuthUsers } from "./auth";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const legalDocumentTypeEnum = pgEnum("legal_document_type", [
  "terms_of_service",
  "terms_of_sale",
  "privacy_policy",
]);

export const legalDocumentStatusEnum = pgEnum("legal_document_status", [
  "draft",
  "published",
  "archived",
]);

// ─── Legal documents (CGU, CGV, Privacy) ──────────────────────────────────────

export const legalDocuments = pgTable(
  "legal_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: legalDocumentTypeEnum("type").notNull(),
    version: text("version").notNull(), // Semantic versioning: "1.0", "1.1", "2.0"
    title: text("title").notNull(),
    content: text("content").notNull(), // Bilingual Markdown (FR + EN in same document)
    changeSummary: text("change_summary"), // Shown during revalidation
    countries: text("countries").array().notNull(), // ISO codes, ["*"] = worldwide
    status: legalDocumentStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("legal_documents_type_status_idx").on(table.type, table.status)]
);

// ─── Legal acceptances (audit trail) ──────────────────────────────────────────

export const legalAcceptances = pgTable(
  "legal_acceptances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legalDocumentId: uuid("legal_document_id")
      .notNull()
      .references(() => legalDocuments.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => betterAuthUsers.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }), // null for CGU (user-level), set for CGV (account-level)
    acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    emailSentAt: timestamp("email_sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("legal_acceptances_document_user_idx").on(table.legalDocumentId, table.userId),
    index("legal_acceptances_document_account_idx").on(table.legalDocumentId, table.accountId),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const legalDocumentsRelations = relations(legalDocuments, ({ many }) => ({
  acceptances: many(legalAcceptances),
}));

export const legalAcceptancesRelations = relations(legalAcceptances, ({ one }) => ({
  document: one(legalDocuments, {
    fields: [legalAcceptances.legalDocumentId],
    references: [legalDocuments.id],
  }),
  user: one(betterAuthUsers, {
    fields: [legalAcceptances.userId],
    references: [betterAuthUsers.id],
  }),
  account: one(accounts, {
    fields: [legalAcceptances.accountId],
    references: [accounts.id],
  }),
}));
