"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { listAcceptancesAction } from "../actions";

import type { LegalDocument } from "@/lib/services/legal-service";

interface AcceptanceItem {
  id: string;
  legalDocumentId: string;
  userId: string;
  accountId: string | null;
  acceptedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  document: { title: string; version: string; type: string };
  user: { name: string; email: string };
  account: { companyName: string | null } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
}

interface AcceptancesListProps {
  initialItems: AcceptanceItem[];
  initialPagination: Pagination;
  documents: LegalDocument[];
}

export function AcceptancesList({
  initialItems,
  initialPagination,
  documents,
}: AcceptancesListProps) {
  const t = useTranslations("admin.legal.acceptances");
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [pagination, setPagination] = useState(initialPagination);
  const [documentFilter, setDocumentFilter] = useState<string>("all");

  function fetchPage(page: number, documentId?: string) {
    startTransition(async () => {
      const result = await listAcceptancesAction({
        page,
        limit: 20,
        documentId: documentId && documentId !== "all" ? documentId : undefined,
      });
      if ("error" in result) return;
      if (!("items" in result)) return;
      setItems(result.items as AcceptanceItem[]);
      setPagination(result.pagination);
    });
  }

  function handleFilterChange(value: string) {
    setDocumentFilter(value);
    fetchPage(1, value);
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Select value={documentFilter} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder={t("filterByDocument")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allDocuments")}</SelectItem>
            {documents.map((doc) => (
              <SelectItem key={doc.id} value={doc.id}>
                {doc.title} (v{doc.version})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[20%]">{t("columns.user")}</TableHead>
            <TableHead className="w-[15%]">{t("columns.account")}</TableHead>
            <TableHead className="w-[25%]">{t("columns.document")}</TableHead>
            <TableHead className="w-[10%]">{t("columns.version")}</TableHead>
            <TableHead className="w-[15%]">{t("columns.acceptedAt")}</TableHead>
            <TableHead className="w-[15%]">{t("columns.ipAddress")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{item.user.name}</p>
                    <p className="text-xs text-muted-foreground">{item.user.email}</p>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{item.account?.companyName ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{item.document.title}</Badge>
                </TableCell>
                <TableCell className="text-sm">{item.document.version}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(item.acceptedAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">
                  {item.ipAddress ?? "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{pagination.total} total</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || isPending}
              onClick={() => fetchPage(pagination.page - 1, documentFilter)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= totalPages || isPending}
              onClick={() => fetchPage(pagination.page + 1, documentFilter)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
