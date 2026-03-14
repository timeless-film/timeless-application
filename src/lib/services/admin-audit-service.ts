import { and, count, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { auditLogs, betterAuthUsers } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditLogRow {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  performedByName: string | null;
  metadata: string | null;
  createdAt: Date;
}

interface ListAuditLogsOptions {
  page: number;
  limit: number;
  search?: string;
  action?: string;
  from?: Date;
  to?: Date;
}

// ─── List audit logs ──────────────────────────────────────────────────────────

export async function listAuditLogs(options: ListAuditLogsOptions) {
  const { page, limit, search, action, from, to } = options;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (action) {
    conditions.push(eq(auditLogs.action, action));
  }
  if (from) {
    conditions.push(gte(auditLogs.createdAt, from));
  }
  if (to) {
    conditions.push(lte(auditLogs.createdAt, to));
  }
  if (search?.trim()) {
    const searchTerm = `%${search.trim()}%`;
    conditions.push(
      sql`(
        ${auditLogs.entityId}::text ILIKE ${searchTerm}
        OR ${auditLogs.action} ILIKE ${searchTerm}
        OR ${auditLogs.metadata} ILIKE ${searchTerm}
      )`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        performedByName: sql<string | null>`(
          SELECT ${betterAuthUsers.name} FROM ${betterAuthUsers}
          WHERE ${betterAuthUsers.id} = ${auditLogs.performedById}
        )`,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(whereClause)
      .orderBy(sql`${auditLogs.createdAt} DESC`)
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(auditLogs).where(whereClause),
  ]);

  return {
    logs: rows as AuditLogRow[],
    total: totalResult[0]?.count ?? 0,
  };
}

// ─── Get distinct action types ────────────────────────────────────────────────

export async function getDistinctActions(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ action: auditLogs.action })
    .from(auditLogs)
    .orderBy(auditLogs.action);

  return rows.map((r) => r.action);
}
