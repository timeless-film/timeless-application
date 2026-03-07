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

import { updateProfile } from "./actions";

interface ProfileInfoFormProps {
  initialName: string;
  initialEmail: string;
}

export function ProfileInfoForm({ initialName, initialEmail }: ProfileInfoFormProps) {
  const t = useTranslations("profile");

  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await updateProfile({ name });

    if (result.error) {
      toast.error(t("error.updateFailed"));
    } else {
      toast.success(t("profileUpdated"));
    }

    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("personalInfo")}</CardTitle>
        <CardDescription>{t("personalInfoDescription")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
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
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            {t("save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
