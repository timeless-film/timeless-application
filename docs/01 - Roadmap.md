# TIMELESS — Roadmap

## Phases

| Phase | Objectif | Sprints | Statut |
|---|---|---|---|
| **P0 — Fondations** | Infra, auth, structure des comptes | S1–S2 | ✅ Done |
| **P1 — Catalogue** | Import, enrichissement TMDB, recherche | S3–S4 | A faire |
| **P2 — Réservation** | Panier, demandes, validation, paiement de base | S5–S7 | A faire |
| **P3 — Finance & Ops** | Stripe Connect, wallets, backoffice, livraison | S8–S10 | A faire |
| **P4 — Polish** | TVA internationale, devises, analytics | S11–S12 | A faire |

---

## Epics

| ID | Nom | Phase | Tickets |
|---|---|---|---|
| [[E01 - Auth & Comptes]] | Authentification & gestion des comptes | P0 | 11 | ✅ Done |
| [[E02 - Exploitants]] | Comptes exploitants de cinéma | P0 | 6 | ✅ Done |
| [[E03 - Ayants Droits]] | Comptes ayants droits | P0 | 3 | ✅ Done |
| [[E04 - Catalogue & Import]] | Import CSV, CRUD, enrichissement TMDB | P1 | 8 |
| [[E05 - Recherche & Catalogue]] | Page catalogue, filtres, fiche film | P1 | 4 | ✅ Done |
| [[E06 - Panier & Demandes]] | Panier, demandes de réservation, expiration | P2 | 7 |
| [[E07 - Workflow Validation]] | Validation par l'ayant droit | P2 | 5 |
| [[E08 - Paiement Stripe]] | Stripe Checkout, TVA, commissions, splits | P2–P3 | 7 |
| [[E09 - Wallet Ayants Droits]] | Dashboard financier, retraits, virements auto | P3 | 4 |
| [[E10 - Livraison Opérationnelle]] | Notifications ops, suivi DCP/KDM | P3 | 4 |
| [[E11 - Backoffice Admin]] | Dashboard admin, gestion comptes, supervision | P3 | 6 |
| [[E12 - Notifications & Emails]] | Setup Resend, tous les flows email | P2–P3 | 8 |
| [[E13 - Sécurité des Accès]] | MFA UI, codes de récupération, audit log | P2–P3 | 5 |

**Total** : 71 tickets

---

## Vue par phase

### P0 — Fondations (Sprint 1–2)
- Setup infra Scaleway (Docker, Postgres, CI/CD)
- Better Auth : email + mdp + MFA
- Structure multi-comptes (exploitant / ayant droit)
- Gestion des utilisateurs et permissions au sein d'un compte

**Livrables** : on peut se connecter, créer un compte, inviter des membres, définir des rôles.

---

### P1 — Catalogue (Sprint 3–4)
- Import CSV/Excel pour les ayants droits
- CRUD manuel films
- Enrichissement automatique TMDB à l'import
- Gestion des prix par pays/devise
- Flag "achat direct" vs "validation requise"
- Page catalogue + filtres + fiche film

**Livrables** : un ayant droit peut alimenter son catalogue, un exploitant peut parcourir et filtrer les films.

---

### P2 — Réservation (Sprint 5–7)
- Panier (nb visionnages, dates, salle)
- Demandes en attente de validation + expiration auto
- Workflow accepter/refuser (email + dashboard)
- Paiement Stripe (panier, paiement unique multi-films)
- Emails essentiels (Customer.io)

**Livrables** : le flow complet de A à Z fonctionne — catalogue → panier → validation → paiement.

---

### P3 — Finance & Ops (Sprint 8–10)
- Stripe Connect : onboarding KYC ayants droits
- Calcul TVA automatique (Stripe Tax)
- Commissions configurables par ayant droit
- Wallet ayant droit (solde, retrait, virement auto)
- Dashboard backoffice admin
- Suivi livraisons DCP/KDM par l'équipe ops

**Livrables** : la plateforme est financièrement autonome et opérationnellement supervisée.

---

### P4 — Polish (Sprint 11–12)
- Devise de préférence exploitant + taux de change temps réel
- TVA internationale (hors EU)
- Analytics et reporting
- Optimisations UX

---

## Légende tickets

| Priorité | Description |
|---|---|
| **P0** | Bloquant — sans ça le flow ne fonctionne pas |
| **P1** | Important — nécessaire pour un usage réel |
| **P2** | Utile — améliore l'expérience, peut être différé |

| Taille | Story points approx. |
|---|---|
| **S** | ½ jour |
| **M** | 1 jour |
| **L** | 2–3 jours |
| **XL** | 1 semaine |
