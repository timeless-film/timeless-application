"use client";

import { KeyRound, Loader2, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { listApiTokens, revokeApiToken } from "./api-token-actions";
import { CreateTokenDialog } from "./create-token-dialog";

interface ApiToken {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

interface ApiTokensSectionProps {
  initialTokens: ApiToken[];
}

export function ApiTokensSection({ initialTokens }: ApiTokensSectionProps) {
  const t = useTranslations("accountSettings.api");
  const locale = useLocale();
  const [tokens, setTokens] = useState<ApiToken[]>(initialTokens);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiToken | null>(null);
  const [revoking, setRevoking] = useState(false);

  async function refreshTokens() {
    const result = await listApiTokens();
    if ("tokens" in result) {
      setTokens(result.tokens as ApiToken[]);
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return;

    setRevoking(true);
    const result = await revokeApiToken(revokeTarget.id);
    setRevoking(false);

    if ("error" in result) {
      toast.error(t(`error.${result.error}`));
    } else {
      toast.success(t("revokeSuccess"));
      setRevokeTarget(null);
      await refreshTokens();
    }
  }

  function formatDate(date: Date | null): string {
    if (!date) return t("lastUsedNever");
    return new Date(date).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  if (tokens.length === 0 && !createOpen) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <KeyRound className="h-10 w-10 text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium">{t("emptyTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("emptyDescription")}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("createButton")}
          </Button>
          <CreateTokenDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={refreshTokens}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t("createButton")}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columnPrefix")}</TableHead>
                <TableHead>{t("columnName")}</TableHead>
                <TableHead>{t("columnCreatedAt")}</TableHead>
                <TableHead>{t("columnLastUsedAt")}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((token) => (
                <TableRow key={token.id}>
                  <TableCell className="font-mono text-sm">{token.tokenPrefix}…</TableCell>
                  <TableCell>{token.name}</TableCell>
                  <TableCell>{formatDate(token.createdAt)}</TableCell>
                  <TableCell>{formatDate(token.lastUsedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="destructive" size="sm" onClick={() => setRevokeTarget(token)}>
                      {t("revoke")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateTokenDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={refreshTokens} />

      {/* Revoke confirmation dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("revokeTitle")}</DialogTitle>
            <DialogDescription>
              {revokeTarget && t("revokeDescription", { name: revokeTarget.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("revokeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
