"use client";

import { Copy, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createApiToken } from "./api-token-actions";

interface CreateTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateTokenDialog({ open, onOpenChange, onCreated }: CreateTokenDialogProps) {
  const t = useTranslations("accountSettings.api");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    const result = await createApiToken(name);
    setLoading(false);

    if ("error" in result) {
      toast.error(t(`error.${result.error}`));
      return;
    }

    setCreatedToken(result.rawToken);
    toast.success(t("createSuccess"));
    onCreated();
  }

  function handleCopy() {
    if (!createdToken) return;
    navigator.clipboard
      .writeText(createdToken)
      .then(() => {
        toast.success(t("copied"));
      })
      .catch(() => {
        // Fallback: select the input for manual copy
      });
  }

  function handleClose() {
    setName("");
    setCreatedToken(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={createdToken ? handleClose : onOpenChange}>
      <DialogContent>
        {createdToken ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("tokenCreatedTitle")}</DialogTitle>
              <DialogDescription>{t("tokenCreatedDescription")}</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Input value={createdToken} readOnly className="font-mono text-sm" />
              <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={handleClose}>
                {t("close")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>{t("createTitle")}</DialogTitle>
              <DialogDescription>{t("createDescription")}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="token-name">{t("nameLabel")}</Label>
              <Input
                id="token-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={loading || !name.trim()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("create")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
