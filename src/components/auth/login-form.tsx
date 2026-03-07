"use client";

import { Loader2 } from "lucide-react";
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
import { authClient, signIn, useSession } from "@/lib/auth/client";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const { data: session, isPending } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMfa, setShowMfa] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  if (isPending) {
    return null;
  }

  if (session?.user) {
    return <AlreadyConnected name={session.user.name} email={session.user.email} />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        const code = result.error.code ?? result.error.message ?? "";
        if (code.toLowerCase().includes("email") && code.toLowerCase().includes("verif")) {
          setError(t("error.emailNotVerified"));
          toast.error(t("error.emailNotVerified"));
        } else {
          setError(t("error.invalidCredentials"));
          toast.error(t("error.invalidCredentials"));
        }
        setLoading(false);
        return;
      }

      // If MFA is required, Better Auth returns a specific response
      if (result.data && "twoFactorRedirect" in result.data) {
        setShowMfa(true);
        setLoading(false);
        return;
      }

      // Successful login — full page reload to pick up session cookie
      window.location.href = "/";
    } catch {
      setError(t("error.invalidCredentials"));
      toast.error(t("error.invalidCredentials"));
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: mfaCode,
      });

      if (result.error) {
        setError(t("error.invalidCredentials"));
        toast.error(t("error.invalidCredentials"));
        return;
      }

      window.location.href = "/";
    } catch {
      setError(t("error.invalidCredentials"));
      toast.error(t("error.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  }

  if (showMfa) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("mfa")}</CardTitle>
          <CardDescription>{t("mfaDescription")}</CardDescription>
        </CardHeader>
        <form onSubmit={handleMfaSubmit}>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-2">
              <Label htmlFor="mfa-code">
                {t("mfaCode")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="000000"
                required
              />
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

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="email">
              {t("email")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">
                {t("password")} <span className="text-destructive">*</span>
              </Label>
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                {t("forgotPassword")}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            {t("submit")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/register" className="text-foreground underline-offset-4 hover:underline">
              {t("register")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
