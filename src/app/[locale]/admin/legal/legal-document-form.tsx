"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";

import {
  archiveLegalDocumentAction,
  createLegalDocumentAction,
  publishLegalDocumentAction,
  updateLegalDocumentAction,
} from "./actions";

import type { LegalDocument } from "@/lib/services/legal-service";

interface LegalDocumentFormProps {
  document?: LegalDocument;
  readOnly?: boolean;
}

const DOCUMENT_TYPES = [
  { value: "terms_of_service", label: "CGU — Terms of Service" },
  { value: "terms_of_sale", label: "CGV — Terms of Sale" },
  { value: "privacy_policy", label: "Privacy Policy" },
] as const;

export function LegalDocumentForm({ document, readOnly }: LegalDocumentFormProps) {
  const t = useTranslations("admin.legal");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<string>(document?.type ?? "terms_of_service");
  const [version, setVersion] = useState(document?.version ?? "");
  const [title, setTitle] = useState(document?.title ?? "");
  const [content, setContent] = useState(document?.content ?? "");
  const [changeSummary, setChangeSummary] = useState(document?.changeSummary ?? "");
  const [countries, setCountries] = useState(document?.countries.join(", ") ?? "*");

  function handleSave() {
    startTransition(async () => {
      const countriesArray = countries
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);

      if (document) {
        const result = await updateLegalDocumentAction({
          id: document.id,
          title,
          content,
          changeSummary: changeSummary || undefined,
          countries: countriesArray,
          version,
        });
        if ("error" in result) {
          toast.error(t(`error.${result.error}`));
          return;
        }
        toast.success(t("saved"));
      } else {
        const result = await createLegalDocumentAction({
          type: type as "terms_of_service" | "terms_of_sale" | "privacy_policy",
          version,
          title,
          content,
          changeSummary: changeSummary || undefined,
          countries: countriesArray,
        });
        if ("error" in result) {
          toast.error(t(`error.${result.error}`));
          return;
        }
        toast.success(t("created"));
        if ("document" in result) {
          router.push(`/admin/legal/${result.document.id}`);
        }
      }
    });
  }

  function handlePublish() {
    if (!document) return;
    startTransition(async () => {
      const result = await publishLegalDocumentAction(document.id);
      if ("error" in result) {
        toast.error(t("error.publishFailed"));
        return;
      }
      toast.success(t("published"));
      router.refresh();
    });
  }

  function handleArchive() {
    if (!document) return;
    startTransition(async () => {
      const result = await archiveLegalDocumentAction(document.id);
      if ("error" in result) {
        toast.error(t("error.archiveFailed"));
        return;
      }
      toast.success(t("archived"));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Link
        href="/admin/legal"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToList")}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{document ? t("documentDetails") : t("createTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">{t("form.type")}</Label>
              {document ? (
                <Input id="type" value={type} disabled />
              ) : (
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((dt) => (
                      <SelectItem key={dt.value} value={dt.value}>
                        {dt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="version">{t("form.version")}</Label>
              <Input
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0"
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">{t("form.title")}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="countries">{t("form.countries")}</Label>
            <Input
              id="countries"
              value={countries}
              onChange={(e) => setCountries(e.target.value)}
              placeholder="* (worldwide) or FR, DE, US"
              disabled={readOnly}
            />
            <p className="text-xs text-muted-foreground">{t("form.countriesHint")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">{t("form.content")}</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="font-mono text-sm"
              disabled={readOnly}
            />
            <p className="text-xs text-muted-foreground">{t("form.contentHint")}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="changeSummary">{t("form.changeSummary")}</Label>
            <Textarea
              id="changeSummary"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              rows={3}
              disabled={readOnly}
            />
          </div>

          {!readOnly && (
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isPending}>
                {document ? t("save") : t("create")}
              </Button>
              {document && document.status === "draft" && (
                <Button variant="secondary" onClick={handlePublish} disabled={isPending}>
                  {t("actions.publish")}
                </Button>
              )}
            </div>
          )}

          {readOnly && document && document.status === "published" && (
            <Button variant="outline" onClick={handleArchive} disabled={isPending}>
              {t("actions.archive")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
