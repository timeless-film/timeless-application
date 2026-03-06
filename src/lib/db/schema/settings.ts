import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";

// ─── Global platform settings ─────────────────────────────────────────────────
// Single row (fixed id "global"), editable by admins only
export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey().default("global"),

  // Pricing
  platformMarginRate: text("platform_margin_rate").notNull().default("0.20"), // 20%
  deliveryFees: integer("delivery_fees").notNull().default(5000), // 50.00 EUR in cents
  defaultCommissionRate: text("default_commission_rate").notNull().default("0.10"), // 10%

  // Operational emails
  opsEmail: text("ops_email").notNull().default("ops@timeless.film"),

  // Delays
  requestExpirationDays: integer("request_expiration_days").notNull().default(30),
  requestUrgencyDaysBeforeStart: integer("request_urgency_days_before_start").notNull().default(7),

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedById: uuid("updated_by_id"), // References users.id (no FK to avoid circular dependencies)
});

// ─── Platform settings history ────────────────────────────────────────────────
export const platformSettingsHistory = pgTable("platform_settings_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value").notNull(),
  changedById: uuid("changed_by_id").notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

// ─── Audit trail ──────────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: text("action").notNull(), // e.g. "account.suspended", "commission.updated"
  entityType: text("entity_type"), // e.g. "account", "film", "order"
  entityId: uuid("entity_id"),
  performedById: uuid("performed_by_id"), // Admin who performed the action
  metadata: text("metadata"), // Stringified JSON with action details
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
