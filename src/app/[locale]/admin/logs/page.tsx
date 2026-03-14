import { getTranslations } from "next-intl/server";

import { AuditLogList } from "@/components/admin/audit-log-list";
import { getDistinctActions, listAuditLogs } from "@/lib/services/admin-audit-service";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.logs");
  return {
    title: t("title"),
  };
}

export default async function LogsPage() {
  const t = await getTranslations("admin.logs");

  const [{ logs, total }, actions] = await Promise.all([
    listAuditLogs({ page: 1, limit: 20 }),
    getDistinctActions(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">{t("title")}</h1>
      <AuditLogList initialLogs={logs} initialTotal={total} availableActions={actions} />
    </div>
  );
}
