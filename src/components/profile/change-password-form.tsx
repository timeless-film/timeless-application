"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
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

import { changePassword } from "./actions";

export function ChangePasswordForm() {
  const t = useTranslations("profile");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error(t("error.passwordMismatch"));
      return;
    }

    if (newPassword.length < 8) {
      toast.error(t("error.weakPassword"));
      return;
    }

    setLoading(true);

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

    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("changePassword")}</CardTitle>
        <CardDescription>{t("changePasswordDescription")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
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
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            {t("updatePassword")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
