/**
 * Seed legal documents (CGU, CGV, Privacy Policy) with bilingual placeholder content.
 * Idempotent — skips creation if documents already exist.
 *
 * Usage: pnpm tsx scripts/seed-legal-documents.ts
 */
import "dotenv/config";

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/lib/db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

// ─── Placeholder content ──────────────────────────────────────────────────────

const TERMS_OF_SERVICE_CONTENT = `# Terms of Service / Conditions Générales d'Utilisation

> **DRAFT — TO BE REPLACED WITH FINAL LEGAL CONTENT**
> **BROUILLON — À REMPLACER PAR LE CONTENU JURIDIQUE DÉFINITIF**

*Version 1.0 — Effective date / Date d'entrée en vigueur: 2026-03-17*

---

## 1. Purpose / Objet

**EN:** These Terms of Service ("Terms") govern your access to and use of the Timeless platform ("Platform"), operated by Timeless SAS ("Timeless", "we", "us"). By creating an account, you agree to be bound by these Terms.

**FR :** Les présentes Conditions Générales d'Utilisation (« CGU ») régissent votre accès et votre utilisation de la plateforme Timeless (« Plateforme »), exploitée par Timeless SAS (« Timeless », « nous »). En créant un compte, vous acceptez d'être lié par ces CGU.

## 2. Account Registration / Inscription

**EN:** You must provide accurate information when creating your account. You are responsible for maintaining the confidentiality of your credentials and for all activities under your account.

**FR :** Vous devez fournir des informations exactes lors de la création de votre compte. Vous êtes responsable de la confidentialité de vos identifiants et de toutes les activités effectuées sous votre compte.

## 3. Acceptable Use / Utilisation acceptable

**EN:** You agree to use the Platform only for lawful purposes and in accordance with these Terms. You shall not: (a) use the Platform to distribute unauthorized content; (b) attempt to gain unauthorized access to any part of the Platform; (c) interfere with the proper functioning of the Platform.

**FR :** Vous acceptez d'utiliser la Plateforme uniquement à des fins licites et conformément aux présentes CGU. Vous ne devez pas : (a) utiliser la Plateforme pour distribuer du contenu non autorisé ; (b) tenter d'accéder sans autorisation à toute partie de la Plateforme ; (c) interférer avec le bon fonctionnement de la Plateforme.

## 4. Intellectual Property / Propriété intellectuelle

**EN:** All content on the Platform, including but not limited to text, graphics, logos, and software, is the property of Timeless or its licensors and is protected by applicable intellectual property laws.

**FR :** Tout le contenu de la Plateforme, y compris, mais sans s'y limiter, les textes, graphiques, logos et logiciels, est la propriété de Timeless ou de ses concédants de licence et est protégé par les lois applicables en matière de propriété intellectuelle.

## 5. Limitation of Liability / Limitation de responsabilité

**EN:** To the maximum extent permitted by applicable law, Timeless shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Platform.

**FR :** Dans la mesure maximale autorisée par la loi applicable, Timeless ne sera pas responsable des dommages indirects, accessoires, spéciaux, consécutifs ou punitifs découlant de ou liés à votre utilisation de la Plateforme.

## 6. Modifications / Modifications

**EN:** We reserve the right to modify these Terms at any time. If we make material changes, we will notify you through the Platform. Your continued use after such notification constitutes acceptance of the modified Terms.

**FR :** Nous nous réservons le droit de modifier ces CGU à tout moment. En cas de modification substantielle, nous vous en informerons via la Plateforme. Votre utilisation continue après notification constitue une acceptation des CGU modifiées.

## 7. Governing Law / Loi applicable

**EN:** These Terms shall be governed by and construed in accordance with the laws of France. Any disputes shall be submitted to the exclusive jurisdiction of the courts of Paris.

**FR :** Les présentes CGU sont régies par le droit français. Tout litige sera soumis à la compétence exclusive des tribunaux de Paris.

## 8. Contact

**EN:** For any questions about these Terms, please contact us at legal@timeless.film.

**FR :** Pour toute question concernant ces CGU, veuillez nous contacter à legal@timeless.film.
`;

const TERMS_OF_SALE_CONTENT = `# Terms of Sale / Conditions Générales de Vente

> **DRAFT — TO BE REPLACED WITH FINAL LEGAL CONTENT**
> **BROUILLON — À REMPLACER PAR LE CONTENU JURIDIQUE DÉFINITIF**

*Version 1.0 — Effective date / Date d'entrée en vigueur: 2026-03-17*

---

## 1. Scope / Champ d'application

**EN:** These Terms of Sale ("Terms") govern all commercial transactions conducted through the Timeless marketplace between exhibitors (cinemas, festivals, ciné-clubs) and rights holders (distributors, archives). Timeless acts as an intermediary platform facilitating these transactions.

**FR :** Les présentes Conditions Générales de Vente (« CGV ») régissent toutes les transactions commerciales effectuées via la marketplace Timeless entre les exploitants (cinémas, festivals, ciné-clubs) et les ayants droit (distributeurs, archives). Timeless agit en tant que plateforme intermédiaire facilitant ces transactions.

## 2. Booking Process / Processus de réservation

**EN:** Exhibitors may browse the film catalog, add films to their cart, and submit booking requests. Rights holders review and approve or decline each request. A binding agreement is formed only upon approval by the rights holder and successful payment.

**FR :** Les exploitants peuvent parcourir le catalogue de films, ajouter des films à leur panier et soumettre des demandes de réservation. Les ayants droit examinent et approuvent ou refusent chaque demande. Un accord contraignant n'est formé qu'après approbation par l'ayant droit et paiement réussi.

## 3. Pricing and Payment / Tarification et paiement

**EN:** All prices are displayed in the exhibitor's preferred currency and are exclusive of applicable taxes. Payment is processed through Stripe. Timeless charges a commission on each transaction as specified in the platform settings.

**FR :** Tous les prix sont affichés dans la devise préférée de l'exploitant et s'entendent hors taxes applicables. Le paiement est traité via Stripe. Timeless prélève une commission sur chaque transaction, telle que spécifiée dans les paramètres de la plateforme.

## 4. Delivery / Livraison

**EN:** Film delivery (DCP/KDM) is coordinated between the rights holder and the exhibitor following successful payment. Delivery timelines and methods are specified per booking request.

**FR :** La livraison des films (DCP/KDM) est coordonnée entre l'ayant droit et l'exploitant après le paiement. Les délais et méthodes de livraison sont spécifiés par demande de réservation.

## 5. Cancellations and Refunds / Annulations et remboursements

**EN:** Cancellation policies are determined by the rights holder for each film. Refunds, when applicable, are processed through Stripe according to the applicable cancellation policy.

**FR :** Les politiques d'annulation sont déterminées par l'ayant droit pour chaque film. Les remboursements, le cas échéant, sont traités via Stripe conformément à la politique d'annulation applicable.

## 6. Liability / Responsabilité

**EN:** Timeless facilitates transactions but does not guarantee the quality, legality, or availability of listed films. Rights holders are solely responsible for the content they list and the rights they grant.

**FR :** Timeless facilite les transactions mais ne garantit pas la qualité, la légalité ou la disponibilité des films listés. Les ayants droit sont seuls responsables du contenu qu'ils mettent en ligne et des droits qu'ils concèdent.

## 7. Governing Law / Loi applicable

**EN:** These Terms shall be governed by French law. Any disputes shall be submitted to the exclusive jurisdiction of the courts of Paris.

**FR :** Les présentes CGV sont régies par le droit français. Tout litige sera soumis à la compétence exclusive des tribunaux de Paris.

## 8. Contact

**EN:** For any questions about these Terms, please contact us at legal@timeless.film.

**FR :** Pour toute question concernant ces CGV, veuillez nous contacter à legal@timeless.film.
`;

const PRIVACY_POLICY_CONTENT = `# Privacy Policy / Politique de Confidentialité

> **DRAFT — TO BE REPLACED WITH FINAL LEGAL CONTENT**
> **BROUILLON — À REMPLACER PAR LE CONTENU JURIDIQUE DÉFINITIF**

*Version 1.0 — Effective date / Date d'entrée en vigueur: 2026-03-17*

---

## 1. Data Controller / Responsable du traitement

**EN:** Timeless SAS, registered in France, is the data controller for personal data collected through the Timeless platform. Contact: legal@timeless.film.

**FR :** Timeless SAS, immatriculée en France, est le responsable du traitement des données personnelles collectées via la plateforme Timeless. Contact : legal@timeless.film.

## 2. Data Collected / Données collectées

**EN:** We collect the following personal data: (a) Account information: name, email address, company name, address, phone number; (b) Usage data: IP address, browser type, pages visited; (c) Transaction data: booking history, payment information (processed by Stripe).

**FR :** Nous collectons les données personnelles suivantes : (a) Informations de compte : nom, adresse email, raison sociale, adresse, numéro de téléphone ; (b) Données d'utilisation : adresse IP, type de navigateur, pages visitées ; (c) Données transactionnelles : historique des réservations, informations de paiement (traitées par Stripe).

## 3. Legal Basis / Base juridique

**EN:** We process your data on the following bases: (a) Contract performance — necessary for providing our services; (b) Legitimate interest — analytics, platform improvement, security; (c) Consent — marketing communications, cookies.

**FR :** Nous traitons vos données sur les bases suivantes : (a) Exécution du contrat — nécessaire à la fourniture de nos services ; (b) Intérêt légitime — analytique, amélioration de la plateforme, sécurité ; (c) Consentement — communications marketing, cookies.

## 4. Data Retention / Conservation des données

**EN:** Personal data is retained for the duration of your account plus 3 years after account closure. Transaction data is retained for 10 years as required by French commercial law.

**FR :** Les données personnelles sont conservées pendant la durée de votre compte plus 3 ans après la clôture du compte. Les données transactionnelles sont conservées pendant 10 ans conformément au droit commercial français.

## 5. Your Rights / Vos droits

**EN:** Under GDPR, you have the right to: (a) Access your personal data; (b) Rectify inaccurate data; (c) Erase your data (right to be forgotten); (d) Restrict processing; (e) Data portability; (f) Object to processing. To exercise these rights, contact: legal@timeless.film.

**FR :** En vertu du RGPD, vous avez le droit de : (a) Accéder à vos données personnelles ; (b) Rectifier les données inexactes ; (c) Effacer vos données (droit à l'oubli) ; (d) Limiter le traitement ; (e) Portabilité des données ; (f) Vous opposer au traitement. Pour exercer ces droits, contactez : legal@timeless.film.

## 6. Cookies

**EN:** We use cookies for essential platform functionality, analytics, and optional marketing purposes. You can manage your cookie preferences through our cookie consent banner. See our Cookie Management page for details.

**FR :** Nous utilisons des cookies pour les fonctionnalités essentielles de la plateforme, l'analytique et des fins marketing optionnelles. Vous pouvez gérer vos préférences de cookies via notre bandeau de consentement. Consultez notre page de gestion des cookies pour plus de détails.

## 7. Data Transfers / Transferts de données

**EN:** Your data may be transferred to and processed in countries outside the EU/EEA. We ensure appropriate safeguards (Standard Contractual Clauses) are in place for such transfers. Our sub-processors include: Stripe (payments), Resend (emails), Scaleway (hosting, France).

**FR :** Vos données peuvent être transférées et traitées dans des pays hors de l'UE/EEE. Nous veillons à ce que des garanties appropriées (Clauses Contractuelles Types) soient en place pour ces transferts. Nos sous-traitants incluent : Stripe (paiements), Resend (emails), Scaleway (hébergement, France).

## 8. Contact / Contact

**EN:** For questions about this policy or to exercise your rights, contact our Data Protection Officer at: legal@timeless.film.

**FR :** Pour toute question concernant cette politique ou pour exercer vos droits, contactez notre Délégué à la Protection des Données à : legal@timeless.film.
`;

// ─── Seed function ────────────────────────────────────────────────────────────

const DOCUMENTS = [
  {
    type: "terms_of_service" as const,
    version: "1.0",
    title: "Terms of Service / Conditions Générales d'Utilisation",
    content: TERMS_OF_SERVICE_CONTENT,
    countries: ["*"],
  },
  {
    type: "terms_of_sale" as const,
    version: "1.0",
    title: "Terms of Sale / Conditions Générales de Vente",
    content: TERMS_OF_SALE_CONTENT,
    countries: ["*"],
  },
  {
    type: "privacy_policy" as const,
    version: "1.0",
    title: "Privacy Policy / Politique de Confidentialité",
    content: PRIVACY_POLICY_CONTENT,
    countries: ["*"],
  },
];

async function seed() {
  console.log("Seeding legal documents...\n");

  for (const doc of DOCUMENTS) {
    // Check if a published document of this type already exists
    const existing = await db
      .select()
      .from(schema.legalDocuments)
      .where(
        and(
          eq(schema.legalDocuments.type, doc.type),
          eq(schema.legalDocuments.status, "published")
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`  ⏭  ${doc.type} v${existing[0]!.version} already published — skipping`);
      continue;
    }

    const [created] = await db
      .insert(schema.legalDocuments)
      .values({
        type: doc.type,
        version: doc.version,
        title: doc.title,
        content: doc.content,
        countries: doc.countries,
        status: "published",
        publishedAt: new Date(),
      })
      .returning();

    console.log(`  ✅ ${doc.type} v${doc.version} published (id: ${created!.id})`);
  }

  console.log("\nDone!");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    client.end();
  });
