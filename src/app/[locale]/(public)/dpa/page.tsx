import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.dpa");
  return { title: t("pageTitle") };
}

export default async function DpaPage() {
  const t = await getTranslations("legal.dpa");

  return (
    <div className="py-8">
      <h1 className="font-heading mb-8 text-3xl">{t("pageTitle")}</h1>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <p>{t("description")}</p>

        <div className="rounded-lg border bg-card p-6">
          <p className="font-medium text-foreground">{t("contact.title")}</p>
          <p className="mt-2">
            {t("contact.description")}{" "}
            <a href="mailto:legal@timeless.film" className="text-primary hover:underline">
              legal@timeless.film
            </a>
          </p>
        </div>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t("scope.title")}</h2>
          <p>{t("scope.content")}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t("subProcessors.title")}</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <strong>Stripe</strong> — {t("subProcessors.stripe")}
            </li>
            <li>
              <strong>Resend</strong> — {t("subProcessors.resend")}
            </li>
            <li>
              <strong>Scaleway</strong> — {t("subProcessors.scaleway")}
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
