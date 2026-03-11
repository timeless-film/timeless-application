# TIMELESS — Présentation du projet

**Site actuel client** : https://www.timeless-cinema.com/
**Domaine plateforme** : `timeless.film`
**Statut** : Phase prototype
**Date de début** : 2026-03-06

---

## Contexte

Rencontre client avec le fondateur de TIMELESS. On se lance dans le développement d'un prototype de l'application.

---

## Concept

TIMELESS est une **marketplace B2B de films classiques et patrimoniaux**. La plateforme connecte deux acteurs du marché cinématographique :

- **Programmateurs** (acheteurs) : cinémas indépendants, festivals, ciné-clubs, organisateurs d'événements
- **Propriétaires de catalogues** (vendeurs) : distributeurs, ayants droit, archives cinématographiques

L'objectif : transformer ce qui est aujourd'hui un processus fragmenté, manuel et chronophage en un **parcours fluide et entièrement digitalisé**.

---

## Problème résolu

Programmer un film classique en dehors des circuits habituels implique aujourd'hui :

1. **Trouver** qui détient les droits pour le territoire concerné (souvent opaque)
2. **Négocier** les conditions et le tarif (emails, appels, délais)
3. **Signer** des contrats et conditions de projection
4. **Payer** (virements, factures manuelles)
5. **Recevoir** le DCP (fichier numérique) et les KDM (clés de déchiffrement)

Chaque étape est une friction. TIMELESS les supprime toutes.

---

## Ce que fait la plateforme

| Fonctionnalité         | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| Catalogue browsable    | Films disponibles par pays, avec droits vérifiés             |
| Gestion des droits     | Disponibilité par territoire, en temps réel                  |
| Réservation en ligne   | Sélection de dates, négociation tarifaire intégrée           |
| Paiement dématérialisé | Paiement et facturation automatisés                          |
| Livraison technique    | Distribution DCP + KDM directement depuis la plateforme      |
| Documentation          | Confirmations, contrats, conditions générées automatiquement |

---

## Positionnement

- **One stop shop** : tout le processus de programmation en un seul endroit
- **Marché de niche à fort potentiel** : les films patrimoniaux reviennent en force (événements, rétrospectives, anniversaires)
- **Soutenu par le CNC** — légitimité institutionnelle forte, signal de crédibilité

---

## Modèle économique

Trois sources de revenus pour TIMELESS, toutes prélevées automatiquement sur chaque transaction :

| Source | Paramètre | Défaut | Visible par |
|---|---|---|---|
| Marge sur prix catalogue | % ajouté au prix ayant droit | À définir | Personne (inclus dans prix final) |
| Frais de livraison | Montant fixe par commande | 50 EUR | Exploitant (ligne séparée) |
| Commission ayant droit | % prélevé sur le prix catalogue | 10% | Ayant droit (déduit de son reversement) |

Voir détail dans [[Epics/E08 - Paiement Stripe]] (section "Modèle de prix").

---

## Stack technique

### Vue d'ensemble

| Couche | Choix | Justification |
|---|---|---|
| Frontend / Backend | Next.js (App Router, TypeScript) | Standard startup, fullstack, large écosystème |
| Base de données | PostgreSQL — Scaleway Managed DB | Robuste, backups auto, reste sur l'infra Scaleway |
| ORM | Drizzle ou Prisma | Drizzle = plus léger/moderne ; Prisma = plus mature |
| Authentification | Better Auth (self-hosted) | Open-source, email+mdp+MFA/TOTP, gratuit, contrôle total |
| Paiement | Stripe + Stripe Connect | International, marketplace natif, splits + KYC vendeurs |
| Emails | Resend (HTTP API) | Transactionnel, simple et fiable |
| Stockage fichiers | Scaleway Object Storage (S3-compatible) | DCPs = 10–50 Go/film, URLs signées pour livraison sécurisée |
| Hébergement | Scaleway (Docker) | Cohérent avec l'infra existante |

### Décisions clés

**Auth — Better Auth plutôt que custom ou Cognito**
- Cognito : trop complexe, trop AWS-centric
- Custom : risqué et long à faire correctement (surtout avec MFA)
- Better Auth : self-hosted, open-source, gère email+mdp+MFA out of the box
- Alternative si on veut aller plus vite au démarrage : Clerk (SaaS, DX excellent, mais payant à l'échelle)

**Paiement — Stripe plutôt que Mollie**
- TIMELESS utilise Mollie, mais sa couverture internationale est limitée
- Stripe Connect est fait pour les marketplaces :
  - Splits de paiement (commission plateforme + reversement aux ayants droit)
  - Onboarding KYC des vendeurs
  - Virements automatiques
  - Multi-devises, paiements internationaux natifs

**Stockage — point d'attention**
- Les fichiers DCP sont très lourds (10–50 Go par film)
- Scaleway Object Storage avec URLs pré-signées et expiration = livraison sécurisée et traçable

---

## Documents du projet

- [[01 - Roadmap]] — Phases, planning, vue macro
- [[Epics/E01 - Auth & Comptes]]
- [[Epics/E02 - Exploitants]]
- [[Epics/E03 - Ayants Droits]]
- [[Epics/E04 - Catalogue & Import]]
- [[Epics/E05 - Recherche & Catalogue]]
- [[Epics/E06 - Panier & Demandes]]
- [[Epics/E07 - Workflow Validation]]
- [[Epics/E08 - Paiement Stripe]]
- [[Epics/E09 - Wallet Ayants Droits]]
- [[Epics/E10 - Livraison Opérationnelle]]
- [[Epics/E11 - Backoffice Admin]]
- [[Epics/E12 - Notifications & Emails]]

---

## Infrastructure & Domaines

| Usage | URL | Statut |
|---|---|---|
| App principale | `app.timeless.film` | À configurer |
| Backoffice admin | `admin.timeless.film` | À configurer |
| API | `api.timeless.film` (si découplé) | À configurer |

**Hébergement** : Scaleway (cohérent avec l'infra existante)
**DNS** : à configurer via le registrar du domaine `timeless.film`

## Comptes à créer

- [ ] GitHub (organisation pour le projet)
- [ ] Stripe (+ activer Connect et Tax)
- [ ] Resend

## Prochaines étapes

- [ ] Définir où mettre le code (dossier local + repo GitHub)
- [ ] Setup environnement de développement (Next.js scaffold)
- [ ] Configurer DNS `timeless.film` vers Scaleway

---

## Notes

