"use client";

import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { AlreadyConnected } from "@/components/auth/already-connected";
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
import { Link } from "@/i18n/navigation";
import { authClient, useSession } from "@/lib/auth/client";

export function ResetPasswordForm() {
  const t = useTranslations("auth.resetPassword");
  const { data: session, isPending } = useSession();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== passwordConfirm) {
      setError(t("error.passwordMismatch"));
      toast.error(t("error.passwordMismatch"));
      return;
    }

    if (!token) {
      setError(t("error.invalidToken"));
      toast.error(t("error.invalidToken"));
      return;
    }

    setLoading(true);

    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (result.error) {
        setError(t("error.invalidToken"));
        toast.error(t("error.invalidToken"));
        return;
      }

      setSuccess(true);
    } catch {
      setError(t("error.invalidToken"));
      toast.error(t("error.invalidToken"));
    } finally {
      setLoading(false);
    }
  }

  if (isPending) {
    return null;
  }

  if (session?.user) {
    return <AlreadyConnected name={session.user.name} email={session.user.email} />;
  }

  if (!token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-destructive">{t("error.invalidToken")}</p>
        </CardContent>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button variant="outline" className="w-full">
              {t("submit")}
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  if (success) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">{t("success")}</p>
        </CardContent>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button className="w-full">{t("submit")}</Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("title")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="password">
              {t("password")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">{t("passwordRules")}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password-confirm">
              {t("passwordConfirm")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="password-confirm"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              minLength={8}
              required
            />
            {passwordConfirm.length > 0 && password !== passwordConfirm && (
              <p className="text-xs text-destructive">{t("error.passwordMismatch")}</p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            {t("submit")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
