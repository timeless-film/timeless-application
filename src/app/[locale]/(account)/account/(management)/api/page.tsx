import { getTranslations } from "next-intl/server";

import { listApiTokens } from "@/components/account/api-token-actions";
import { ApiTokensSection } from "@/components/account/api-tokens-section";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("accountSettings.api");
  return {
    title: t("title"),
  };
}

export default async function ApiPage() {
  const result = await listApiTokens();
  const tokens = "tokens" in result && result.tokens ? result.tokens : [];

  return <ApiTokensSection initialTokens={tokens} />;
}
