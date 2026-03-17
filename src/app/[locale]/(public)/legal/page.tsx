import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.notices");
  return { title: t("pageTitle") };
}

export default async function LegalNoticesPage() {
  const t = await getTranslations("legal.notices");

  return (
    <div className="py-8">
      <h1 className="font-heading mb-8 text-3xl">{t("pageTitle")}</h1>

      <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t("publisher.title")}</h2>
          <p>Timeless SAS</p>
          <p>Capital: €10,000</p>
          <p>RCS Paris — Registration pending</p>
          <p>Registered office: Paris, France</p>
          <p>Publication director: [Name of legal representative]</p>
          <p>
            Contact:{" "}
            <a href="mailto:legal@timeless.film" className="text-primary hover:underline">
              legal@timeless.film
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t("hosting.title")}</h2>
          <p>Scaleway SAS</p>
          <p>8 rue de la Ville l&apos;Evêque, 75008 Paris, France</p>
          <p>
            Website:{" "}
            <a
              href="https://www.scaleway.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              www.scaleway.com
            </a>
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            {t("intellectualProperty.title")}
          </h2>
          <p>{t("intellectualProperty.content")}</p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-foreground">{t("personalData.title")}</h2>
          <p>{t("personalData.content")}</p>
        </section>
      </div>
    </div>
  );
}
