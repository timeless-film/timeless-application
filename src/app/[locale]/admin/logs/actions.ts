"use server";

import { getCurrentMembership } from "@/lib/auth/membership";
import { listAuditLogs } from "@/lib/services/admin-audit-service";

interface ListAuditLogsInput {
  search?: string;
  action?: string;
  page: number;
  limit: number;
}

export async function getAuditLogsPaginated(input: ListAuditLogsInput) {
  const ctx = await getCurrentMembership();
  if (!ctx) return { error: "UNAUTHORIZED" as const };
  if (ctx.account.type !== "admin") return { error: "FORBIDDEN" as const };

  const result = await listAuditLogs({
    page: input.page,
    limit: input.limit,
    search: input.search,
    action: input.action,
  });

  return { logs: result.logs, total: result.total };
}
