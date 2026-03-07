"use client";

import { Loader2, LogOut, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOut } from "@/lib/auth/client";

import { changePassword, revokeAllOtherSessions, revokeSession, updateProfile } from "./actions";

interface SessionInfo {
  id: string;
  token: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
}

interface ProfileFormProps {
  initialSessions: SessionInfo[];
  initialName: string;
  initialEmail: string;
  currentSessionToken: string;
}

export function ProfileForm({
  initialSessions,
  initialName,
  initialEmail,
  currentSessionToken,
}: ProfileFormProps) {
  const t = useTranslations("profile");
  const locale = useLocale();
  const router = useRouter();

  // Profile state — initialized from server props
  const [name, setName] = useState(initialName);
  const [profileLoading, setProfileLoading] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Sessions state — initialized from server props
  const [sessions] = useState<SessionInfo[]>(initialSessions);
  const [sessionsLoading] = useState(false);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setProfileLoading(true);

    const result = await updateProfile({ name });

    if (result.error) {
      toast.error(t("error.updateFailed"));
    } else {
      toast.success(t("profileUpdated"));
    }

    setProfileLoading(false);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error(t("error.passwordMismatch"));
      return;
    }

    if (newPassword.length < 8) {
      toast.error(t("error.weakPassword"));
      return;
    }

    setPasswordLoading(true);

    const result = await changePassword({
      currentPassword,
      newPassword,
    });

    if (result.error) {
      toast.error(t("error.changeFailed"));
    } else {
      toast.success(t("passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }

    setPasswordLoading(false);
  }

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
    <div className="space-y-6">
      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle>{t("personalInfo")}</CardTitle>
          <CardDescription>{t("personalInfoDescription")}</CardDescription>
        </CardHeader>
        <form onSubmit={handleProfileSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" value={initialEmail} disabled />
              <p className="text-xs text-muted-foreground">{t("emailHint")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">
                {t("name")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={profileLoading}>
              {profileLoading && <Loader2 className="animate-spin" />}
              {t("save")}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle>{t("changePassword")}</CardTitle>
          <CardDescription>{t("changePasswordDescription")}</CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">
                {t("currentPassword")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">
                {t("newPassword")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
              <p className="text-xs text-muted-foreground">{t("passwordRules")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {t("confirmPassword")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">{t("error.passwordMismatch")}</p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading && <Loader2 className="animate-spin" />}
              {t("updatePassword")}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Active sessions */}
      <Card>
        <CardHeader>
          <CardTitle>{t("activeSessions")}</CardTitle>
          <CardDescription>{t("activeSessionsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsLoading ? (
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRevokeSession(s.token)}
                    >
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
            onClick={() =>
              signOut({
                fetchOptions: {
                  onSuccess: () => {
                    window.location.href = "/";
                  },
                },
              })
            }
          >
            <LogOut className="h-4 w-4" />
            {t("signOut")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
