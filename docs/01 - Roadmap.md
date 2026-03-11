# TIMELESS — Roadmap

## Phases

| Phase | Objectif | Sprints | Statut |
|---|---|---|---|
| **P0 — Fondations** | Infra, auth, structure des comptes | S1–S2 | ✅ Done |
| **P1 — Catalogue** | Import, enrichissement TMDB, recherche | S3–S4 | ✅ Done |
| **P2 — Réservation** | Panier, demandes, validation, paiement | S5–S7 | ✅ Done |
| **P3 — Finance & Ops** | Stripe Connect, wallets, backoffice, livraison | S8–S10 | A faire |
| **P4 — Polish** | TVA internationale, devises, analytics | S11–S12 | A faire |

---

## Epics

| ID | Nom | Phase | Tickets | Statut |
|---|---|---|---|---|
| [[E01 - Auth & Comptes]] | Authentification & gestion des comptes | P0 | 11 | ✅ Done |
| [[E02 - Exploitants]] | Comptes exploitants de cinéma | P0 | 6 | ✅ Done |
| [[E03 - Ayants Droits]] | Comptes ayants droits | P0 | 3 | ✅ Done |
| [[E04 - Catalogue & Import]] | Import CSV/Excel, CRUD, enrichissement TMDB | P1 | 8 | ✅ Done |
| [[E05 - Recherche & Catalogue]] | Page catalogue, filtres, fiche film, analytics | P1 | 4 | ✅ Done |
| [[E06 - Panier & Demandes]] | Panier, demandes de réservation, expiration | P2 | 7 | ✅ Done |
| [[E07 - Workflow Validation]] | Validation par l'ayant droit (email + dashboard) | P2 | 7 | ✅ Done |
| [[E08 - Paiement Stripe]] | Stripe Checkout, TVA, commissions, transfers | P2–P3 | 12 | ✅ Done |
| [[E09 - Wallet Ayants Droits]] | Dashboard financier, retraits, virements auto | P3 | 4 | ⬜ A faire |
| [[E10 - Livraison Opérationnelle]] | Notifications ops, suivi DCP/KDM | P3 | 4 | ⬜ A faire |
| [[E11 - Backoffice Admin]] | Dashboard admin, gestion comptes, supervision | P3 | 7 | ⬜ A faire |
| [[E13 - Sécurité des Accès]] | MFA UI, codes de récupération, audit log | P2–P3 | 5 | ⬜ A faire |

**Total** : 78 tickets

---

## Vue par phase

### P0 — Fondations (Sprint 1–2) ✅
- Better Auth : email + mdp + MFA/TOTP
- Structure multi-comptes (exploitant / ayant droit / admin)
- Gestion des utilisateurs et permissions (owner/admin/member)
- Invitations, changement de mot de passe, sessions actives
- Onboarding exploitant multi-étapes
- CRUD cinémas et salles, listes pays/devises
- Tokens API pour intégrations tierces
- Stripe Connect Express pour les ayants droits

**Livrables** : connexion, comptes, invitations, rôles, cinémas/salles, onboarding, Stripe Connect. ✅

---

### P1 — Catalogue (Sprint 3–4) ✅
- Import CSV/Excel avec sync (ajout / mise à jour / archivage)
- CRUD manuel films + enrichissement TMDB
- Pricing multi-zone (pays/devise) par film
- Flag "achat direct" vs "validation requise"
- Page catalogue exploitant avec recherche et filtres avancés
- Fiche film détaillée avec prix en devise locale
- Dashboard analytics pour ayants droits (vues, demandes)

**Livrables** : catalogue complet, import, recherche, filtres, analytics. ✅

---

### P2 — Réservation (Sprint 5–7) ✅
- ✅ Panier persistant (nb visionnages, dates, salle)
- ✅ Demandes de réservation (films en validation requise)
- ✅ Expiration automatique des demandes
- ✅ Historique commandes exploitant
- ✅ Workflow validation ayant droit (email + dashboard) — E07
- ✅ Paiement Stripe Checkout — E08
- ✅ Emails transactionnels (Resend) — intégrés dans E07/E08

**Livrables** : flow complet catalogue → panier → validation → paiement. ✅

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
