"use client";

import { Loader2, LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ACTIVE_ACCOUNT_COOKIE } from "@/lib/auth/active-account-cookie";
import { signOut } from "@/lib/auth/client";

import { revokeAllOtherSessions, revokeSession } from "./actions";

export interface SessionInfo {
  id: string;
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

interface SessionsListProps {
  sessions: SessionInfo[];
  currentSessionToken: string;
  isLoading?: boolean;
}

export function SessionsList({
  sessions,
  currentSessionToken,
  isLoading = false,
}: SessionsListProps) {
  const t = useTranslations("profile");
  const locale = useLocale();
  const router = useRouter();

  async function handleRevokeSession(token: string) {
    const result = await revokeSession(token);
    if (result.error) {
      toast.error(t("error.revokeFailed"));
    } else {
      toast.success(t("sessionRevoked"));
      router.refresh();
    }
  }

  async function handleRevokeAll() {
    const result = await revokeAllOtherSessions();
    if (result.error) {
      toast.error(t("error.revokeFailed"));
    } else {
      toast.success(t("allSessionsRevoked"));
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("activeSessions")}</CardTitle>
        <CardDescription>{t("activeSessionsDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {s.userAgent
                      ? s.userAgent.substring(0, 60) + (s.userAgent.length > 60 ? "…" : "")
                      : t("unknownDevice")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.ipAddress ?? t("unknownIp")} ·{" "}
                    {new Date(s.createdAt).toLocaleDateString(locale)}
                  </p>
                </div>
                {s.token !== currentSessionToken && (
                  <Button variant="ghost" size="icon" onClick={() => handleRevokeSession(s.token)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-3">
        <Button variant="outline" className="w-full" onClick={handleRevokeAll}>
          <LogOut className="h-4 w-4" />
          {t("revokeAllSessions")}
        </Button>
        <Button
          variant="destructive"
          className="w-full"
          onClick={() => {
            document.cookie = `${ACTIVE_ACCOUNT_COOKIE}=; path=/; max-age=0`;
            signOut({
              fetchOptions: {
                onSuccess: () => {
                  window.location.href = "/";
                },
              },
            });
          }}
        >
          <LogOut className="h-4 w-4" />
          {t("signOut")}
        </Button>
      </CardFooter>
    </Card>
  );
}
