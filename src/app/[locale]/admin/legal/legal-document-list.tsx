"use client";

import { Archive, Eye, MoreHorizontal, Pencil, Plus, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";

import { archiveLegalDocumentAction, publishLegalDocumentAction } from "./actions";

import type { LegalDocument } from "@/lib/services/legal-service";

interface LegalDocumentListProps {
  initialDocuments: LegalDocument[];
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  published: "default",
  archived: "outline",
};

const TYPE_LABELS: Record<string, string> = {
  terms_of_service: "CGU",
  terms_of_sale: "CGV",
  privacy_policy: "Privacy",
};

export function LegalDocumentList({ initialDocuments }: LegalDocumentListProps) {
  const t = useTranslations("admin.legal");
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [publishConfirm, setPublishConfirm] = useState<string | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<string | null>(null);

  async function handlePublish(id: string) {
    const result = await publishLegalDocumentAction(id);
    if ("error" in result) {
      toast.error(t("error.publishFailed"));
      return;
    }
    if (!("document" in result)) return;
    toast.success(t("published"));
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id === id) return result.document;
        // Archive previously published of same type
        if (d.type === result.document.type && d.status === "published" && d.id !== id) {
          return { ...d, status: "archived" as const };
        }
        return d;
      })
    );
    setPublishConfirm(null);
  }

  async function handleArchive(id: string) {
    const result = await archiveLegalDocumentAction(id);
    if ("error" in result) {
      toast.error(t("error.archiveFailed"));
      return;
    }
    if (!("document" in result)) return;
    toast.success(t("archived"));
    setDocuments((prev) => prev.map((d) => (d.id === id ? result.document : d)));
    setArchiveConfirm(null);
  }

  return (
    <>
      <div className="flex justify-end">
        <Link href="/admin/legal/new">
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t("create")}
          </Button>
        </Link>
      </div>

      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[25%]">{t("columns.title")}</TableHead>
            <TableHead className="w-[12%]">{t("columns.type")}</TableHead>
            <TableHead className="w-[10%]">{t("columns.version")}</TableHead>
            <TableHead className="w-[12%]">{t("columns.status")}</TableHead>
            <TableHead className="w-[15%]">{t("columns.countries")}</TableHead>
            <TableHead className="w-[16%]">{t("columns.publishedAt")}</TableHead>
            <TableHead className="w-[10%]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                {t("empty")}
              </TableCell>
            </TableRow>
          ) : (
            documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <Link
                    href={`/admin/legal/${doc.id}`}
                    className="text-primary font-medium hover:underline"
                  >
                    {doc.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{TYPE_LABELS[doc.type] ?? doc.type}</Badge>
                </TableCell>
                <TableCell>{doc.version}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[doc.status] ?? "outline"}>
                    {t(`status.${doc.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {doc.countries.includes("*") ? t("worldwide") : doc.countries.join(", ")}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {doc.publishedAt ? new Date(doc.publishedAt).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/admin/legal/${doc.id}`)}>
                        {doc.status === "draft" ? (
                          <>
                            <Pencil className="mr-2 h-4 w-4" />
                            {t("actions.edit")}
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 h-4 w-4" />
                            {t("actions.view")}
                          </>
                        )}
                      </DropdownMenuItem>
                      {doc.status === "draft" && (
                        <DropdownMenuItem onClick={() => setPublishConfirm(doc.id)}>
                          <Send className="mr-2 h-4 w-4" />
                          {t("actions.publish")}
                        </DropdownMenuItem>
                      )}
                      {doc.status === "published" && (
                        <DropdownMenuItem onClick={() => setArchiveConfirm(doc.id)}>
                          <Archive className="mr-2 h-4 w-4" />
                          {t("actions.archive")}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Publish confirmation */}
      <AlertDialog open={!!publishConfirm} onOpenChange={() => setPublishConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmPublish.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmPublish.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirmPublish.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => publishConfirm && handlePublish(publishConfirm)}>
              {t("confirmPublish.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive confirmation */}
      <AlertDialog open={!!archiveConfirm} onOpenChange={() => setArchiveConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmArchive.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmArchive.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("confirmArchive.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => archiveConfirm && handleArchive(archiveConfirm)}>
              {t("confirmArchive.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
