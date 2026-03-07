"use client";

import { Clock, Loader2, Mail, Trash2, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { cancelInvitation, getPendingInvitations, inviteMember } from "./actions";

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  createdAt: Date;
}

interface InviteSectionProps {
  initialInvitations: PendingInvitation[];
}

export function InviteSection({ initialInvitations }: InviteSectionProps) {
  const t = useTranslations("members");
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [loading, setLoading] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>(
    initialInvitations as PendingInvitation[]
  );
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function loadInvitations() {
    const result = await getPendingInvitations();
    if (result.invitations) {
      setPendingInvitations(result.invitations as PendingInvitation[]);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) return;

    setLoading(true);
    const result = await inviteMember({ email: email.trim(), role });

    if (result.error) {
      const errorKey = `error.invite.${result.error}`;
      toast.error(t(errorKey));
    } else {
      toast.success(t("inviteSent"));
      setEmail("");
      setRole("member");
      await loadInvitations();
    }
    setLoading(false);
  }

  async function handleCancel(invitationId: string) {
    setCancellingId(invitationId);
    const result = await cancelInvitation(invitationId);
    if (result.error) {
      toast.error(t("error.cancelFailed"));
    } else {
      toast.success(t("inviteCancelled"));
      await loadInvitations();
    }
    setCancellingId(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          {t("invite.title")}
        </CardTitle>
        <CardDescription>{t("invite.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">
              {t("invite.email")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="invite-email"
              type="email"
              placeholder={t("invite.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t("invite.role")}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={role === "member" ? "default" : "outline"}
                size="sm"
                onClick={() => setRole("member")}
              >
                {t("role.member")}
              </Button>
              <Button
                type="button"
                variant={role === "admin" ? "default" : "outline"}
                size="sm"
                onClick={() => setRole("admin")}
              >
                {t("role.admin")}
              </Button>
            </div>
          </div>
          <Button type="submit" disabled={loading || !email.trim()}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Mail className="mr-2 h-4 w-4" />
            )}
            {t("invite.send")}
          </Button>
        </form>

        {/* Pending invitations */}
        {pendingInvitations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">{t("invite.pending")}</h4>
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {t(`role.${inv.role}`)} &middot;{" "}
                      {t("invite.expiresAt", {
                        date: new Date(inv.expiresAt).toLocaleDateString(locale),
                      })}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  title={t("invite.cancel")}
                  disabled={cancellingId === inv.id}
                  onClick={() => handleCancel(inv.id)}
                >
                  {cancellingId === inv.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
