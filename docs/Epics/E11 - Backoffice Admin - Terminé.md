# E11 — Backoffice Admin

**Phase** : P3
**Prérequis de** : [[E10 - Livraison Opérationnelle]] (E10 construit ses vues dans le backoffice créé ici)

---

## Contexte

Le backoffice est réservé aux comptes de type `admin`. Il centralise la supervision de la plateforme, la gestion des comptes, la configuration tarifaire, le suivi des commandes, et le pilotage opérationnel.

L'accès admin est déjà prévu dans l'architecture :
- Le type de compte `admin` existe dans l'enum `accountType` (`exhibitor | rights_holder | admin`)
- Le `proxy.ts` définit déjà les `ADMIN_PATHS` (`/admin/dashboard`, `/admin/exhibitors`, `/admin/rights-holders`, `/admin/orders`, `/admin/requests`, `/admin/films`, `/admin/deliveries`, `/admin/settings`, `/admin/logs`) et redirige tout non-admin vers sa home
- Le cookie `timeless_active_account` contient le type de compte et sert de guard côté routing

---

## Infrastructure existante

Le schéma DB et les services nécessaires au backoffice sont déjà en place :

| Composant | Fichier | Détail |
|-----------|---------|--------|
| Table `platformSettings` | `schema/settings.ts` | Ligne unique (`id="global"`) : `platformMarginRate` (20%), `deliveryFees` (5000 cts = 50 €), `defaultCommissionRate` ("0"), `opsEmail`, `requestExpirationDays`, `requestUrgencyDaysBeforeStart` |
| Table `platformSettingsHistory` | `schema/settings.ts` | Historique de chaque modification : champ, ancienne/nouvelle valeur, date, admin |
| Table `auditLogs` | `schema/settings.ts` | Action, entityType, entityId, performedById, metadata (JSON) |
| Champ `accounts.commissionRate` | `schema/accounts.ts` | Override de commission par ayant droit (décimal string, ex: `"0.05"`) |
| Champ `accounts.status` | `schema/accounts.ts` | Enum `active | suspended` — suspension déjà prévue |
| Champ `orderItems.deliveryStatus` | `schema/orders.ts` | Enum `pending | in_progress | delivered` — suivi livraison par item |
| Champ `orderItems.deliveryNotes` | `schema/orders.ts` | Notes ops (texte libre) |
| Champ `orderItems.deliveredAt` | `schema/orders.ts` | Timestamp de livraison |
| `analytics-service.ts` | `services/` | `getTotalRevenue()`, `getMonthlyRevenue()`, `getTopFilms()`, `getTopExhibitors()`, `getSalesMetrics()` |
| `wallet-service.ts` | `services/` | Lecture soldes/transfers/payouts via API Stripe Connect |
| `order-service.ts` | `services/` | Requêtes `orders` / `orderItems` |
| Pricing engine | `lib/pricing/` | `calculatePricing()`, `getPlatformPricingSettings()`, `resolveCommissionRate()` |

---

## Tickets

### E11-001 — Layout admin & navigation ✅
**Priorité** : P0 | **Taille** : M | **Statut** : ✅ Done

Shell du backoffice : layout, sidebar, routing, guards. C'est le prérequis de tous les autres tickets.

**Dossier** : `src/app/[locale]/admin/` (dossier réel, pas un route group — le préfixe `/admin` apparaît dans l'URL)

**Layout** :
- Sidebar avec navigation : Dashboard, Commandes, Demandes, Films, Exploitants, Ayants droits, Livraisons, Paramètres, Logs
- Header avec nom de l'admin connecté
- Responsive (collapse sidebar sur mobile)

**Routing & Guards** :
- Le `proxy.ts` redirige déjà les non-admin — vérifier que le guard fonctionne
- Layout server component : vérifier `session` + `account.type === "admin"`, sinon redirect
- Ajouter les entrées de navigation dans la sidebar (i18n `admin.*`)

**Traductions** : namespace `admin` dans `messages/en.json` et `messages/fr.json`

---

### E11-002 — Dashboard global
**Priorité** : P1 | **Taille** : M | **Statut** : ✅ Done

Page `/admin/dashboard` — vue d'ensemble de l'activité plateforme.

**KPI Cards** (ligne du haut) :
- Revenu TIMELESS ce mois (marge + frais de livraison — `timelessAmount` agrégé sur `orderItems`)
- Commandes ce mois (count `orders` du mois en cours)
- Demandes en attente (count `requests` en statut `pending`)
- Livraisons à traiter (count `orderItems` avec `deliveryStatus = pending`)

**Ligne secondaire de KPIs** :
- Comptes exploitants actifs (count `accounts` type `exhibitor`, status `active`)
- Comptes ayants droits actifs (count `accounts` type `rights_holder`, status `active`)
- Films au catalogue (count `films` status `active`)
- Onboardings en attente (count `accounts` avec `onboardingCompleted = false` ou `stripeConnectOnboardingComplete = false`)

**Graphiques** :
- Évolution du revenu mensuel (12 derniers mois — `getMonthlyRevenue()`)
- Top 5 films les plus commandés (`getTopFilms()`)
- Top 5 exploitants par volume (`getTopExhibitors()`)

**Section "Payouts ayants droits"** :
- Derniers payouts en échec (badge rouge si > 0)
- Tableau récapitulatif : ayant droit, montant, statut (`pending` / `in_transit` / `paid` / `failed`), date
- Lien vers la fiche ayant droit pour chaque payout
- Données via `wallet-service.ts` (API Stripe Connect)

> Le service `analytics-service.ts` fournit déjà certaines requêtes. Adapter/ajouter pour les nouvelles métriques (comptes, films, onboardings).
> Le suivi global des payouts était reporté de E09 vers E11 (cf. E09 — Hors scope).

---

### E11-003 — Gestion des ayants droits ✅
**Priorité** : P0 | **Taille** : L | **Statut** : ✅ Done (partiel — listing, suspend/reactivate, commission)

Page `/admin/rights-holders` — liste et gestion des comptes ayants droits.

**Tableau** :

| Colonne | Source |
|---------|--------|
| Raison sociale | `accounts.companyName` |
| Pays | `accounts.country` (affiché avec `Intl.DisplayNames`) |
| Films actifs | Count `films` avec `status = active` |
| Stripe Connect | `accounts.stripeConnectOnboardingComplete` (badge vert/rouge) |
| Commission | `accounts.commissionRate` ou défaut global (`platformSettings.defaultCommissionRate`) |
| Statut | `accounts.status` (badge `active` / `suspended`) |

**Actions** :
- **Créer un ayant droit** : formulaire (raison sociale, pays, email de contact) → crée le compte `type = rights_holder` **sans utilisateur associé** + envoie une invitation email. Quand l'invité crée son compte utilisateur, il est rattaché au compte RH. Le premier connecté avec rôle owner/admin doit compléter l'onboarding.
- **Inviter des membres** : depuis la fiche, envoyer des invitations à d'autres emails (même flow que les invitations existantes E01)
- **Fiche détail** : infos du compte, commission, statut Stripe Connect, liste des films, historique des commissions
- **Modifier la commission** → voir E11-004
- **Suspendre / réactiver** : passe `accounts.status` à `suspended` / `active`. Un compte suspendu : ses films disparaissent du catalogue, les utilisateurs sont redirigés vers `/accounts` (le compte n'apparaît plus comme sélectionnable), les appels API pour ce compte sont bloqués. Les comptes utilisateurs ne sont pas impactés. Log dans `auditLogs`
- **Voir le catalogue** : lien vers la liste des films de l'ayant droit (réutilise `listFilmsForAccount()`)
- **Membres & invitations** (section dans la fiche) :
  - Tableau des membres actuels (`accountMembers` + `betterAuthUsers`) : nom, email, rôle (`owner` / `admin` / `member`), date d'ajout
  - Tableau des invitations en attente (`invitations` avec `status = pending`) : email, rôle proposé, date d'envoi, action d'annulation
  - Réinitialiser le MFA d'un utilisateur bloqué (suppression du TOTP enregistré)
- **Payouts** (section dans la fiche) :
  - Derniers virements bancaires pour cet ayant droit (via API Stripe Connect)
  - Statuts : `pending` / `in_transit` / `paid` / `failed`
  - Configuration auto-payout : affichage du schedule configuré par l'ayant droit

Filtres : statut (actif / suspendu), pays, statut Stripe Connect.
Recherche par nom.

---

### E11-004 — Configuration des commissions par ayant droit ✅
**Priorité** : P0 | **Taille** : S | **Statut** : ✅ Done (intégré dans E11-003)

Depuis la fiche d'un ayant droit (E11-003), section "Commission" :

- Affichage du taux actuel (`accounts.commissionRate` ou `"défaut (X%)"` si null)
- Formulaire de modification : champ pourcentage (0-100%) avec validation Zod
- Confirmation obligatoire avant enregistrement (dialog "Êtes-vous sûr ?")
- La modification s'applique **uniquement aux nouvelles commandes** — les `orderItems` existants conservent leur `commissionRate` snapshotté
- Chaque modification est loguée dans `auditLogs` avec `action: "commission.updated"`, `entityType: "account"`, metadata `{ oldRate, newRate }`

**Historique des modifications** : tableau chronologique (date, ancienne valeur → nouvelle valeur, admin) — requête sur `auditLogs` filtré par `entityId` et action.

> Note : le modèle actuel est "marge uniquement" (`defaultCommissionRate = "0"`). La commission est un levier futur. L'infrastructure est prête mais le taux par défaut reste 0 %.

---

### E11-005 — Gestion des exploitants ✅
**Priorité** : P1 | **Taille** : M | **Statut** : ✅ Done (partiel — listing, suspend/reactivate, search)

Page `/admin/exhibitors` — liste et consultation des comptes exploitants.

**Tableau** :

| Colonne | Source |
|---------|--------|
| Raison sociale | `accounts.companyName` |
| Pays | `accounts.country` |
| Cinémas | Count `cinemas` (non archivés) |
| Commandes | Count `orders` |
| Onboarding | `accounts.onboardingCompleted` (badge) |
| Statut | `accounts.status` |

**Actions** :
- **Créer un exploitant** : formulaire (raison sociale, pays, email de contact) → crée le compte `type = exhibitor` **sans utilisateur associé** + envoie une invitation email. Même logique que la création d'ayant droit (E11-003). Le premier connecté avec rôle owner/admin doit compléter l'onboarding.
- **Inviter des membres** : depuis la fiche, envoyer des invitations
- **Fiche détail** : infos du compte, liste des cinémas (+ salles), historique des commandes
- **Suspendre / réactiver** : même logique que E11-003 (redirection `/accounts`, API bloquée, utilisateurs non impactés). Log dans `auditLogs`
- **Voir les commandes** : lien vers la vue commandes filtrée sur cet exploitant
- **Membres & invitations** (section dans la fiche) :
  - Tableau des membres actuels (`accountMembers` + `betterAuthUsers`) : nom, email, rôle, date d'ajout
  - Tableau des invitations en attente : email, rôle proposé, date d'envoi, action d'annulation
  - Réinitialiser le MFA d'un utilisateur bloqué
- **API tokens** (section dans la fiche) :
  - Tableau des tokens actifs (`apiTokens`) : nom, préfixe, date de création, dernière utilisation
  - Action de **révocation** d'un token (suppression) — log dans `auditLogs` avec `action: "api_token.revoked"`

Note : les exploitants peuvent aussi s'inscrire eux-mêmes via `/register`.

Filtres : statut, pays, onboarding complété.
Recherche par nom.

---

### E11-006 — Vue des commandes & remboursements ✅
**Priorité** : P0 | **Taille** : L | **Statut** : ✅ Done (partiel — listing, search, status filter, refund logic)

Page `/admin/orders` — toutes les commandes de la plateforme.

**Tableau des commandes** :

| Colonne | Source |
|---------|--------|
| N° commande | `orders.orderNumber` (formaté `ORD-000042`) |
| Exploitant | `accounts.companyName` (via `exhibitorAccountId`) |
| Date | `orders.paidAt` |
| Nb films | Count `orderItems` |
| Total | `orders.total` (formaté avec devise) |
| Statut | `orders.status` (`paid` / `processing` / `delivered` / `refunded`) |

**Fiche commande** (détail) :
- Récapitulatif : exploitant, date, montant, TVA (`taxAmount`, `taxRate`, `reverseCharge`), facture Stripe
- Tableau des items : film, ayant droit, cinéma, salle, dates de diffusion, nb visionnages, prix affiché, montant ayant droit, montant TIMELESS, statut livraison
- Lien vers la facture Stripe (`stripeInvoiceId`)

**Remboursement** (action sur une commande de moins de 48h, statut `paid` ou `processing`) :
- Remboursement **total uniquement** — pas de remboursement par item (une commande peut impliquer plusieurs ayants droits, la granularité par item est reportée au futur)
- Condition : `paidAt` < 48h (droit de rétractation)
- Bouton "Rembourser" → dialog de confirmation avec motif obligatoire
- Appel `stripe.refunds.create()` sur le PaymentIntent (remboursement total)
- Annulation de tous les transfers Stripe Connect (`stripe.transfers.createReversal()`) pour chaque `orderItem.stripeTransferId`
- Annulation de toutes les livraisons en cours : `orderItems.deliveryStatus` → reset, notes de livraison effacées
- Passage de `orders.status` à `refunded`
- Email de notification à l'exploitant ("votre commande a été remboursée, vous pouvez repasser commande")
- Log dans `auditLogs` avec `action: "order.refunded"`

> Le remboursement est explicitement reporté de E09 vers E11 (voir E09 — Hors scope). Le remboursement granulaire (par item) est reporté au futur.

Filtres : statut, exploitant, ayant droit, période.
Recherche par numéro de commande.

---

### E11-007 — Configuration globale des tarifs plateforme ✅
**Priorité** : P0 | **Taille** : M | **Statut** : ✅ Done

Page `/admin/settings` — paramètres tarifaires et opérationnels.

**Section "Tarification"** :

| Paramètre | Champ DB | Valeur actuelle | Description |
|---|---|---|---|
| Marge plateforme | `platformMarginRate` | 20% (`"0.20"`) | Ajoutée au prix catalogue pour calculer le prix affiché |
| Frais de livraison | `deliveryFees` | 50 € (`5000` cts) | Par film, ajoutés en ligne séparée au checkout |
| Commission par défaut | `defaultCommissionRate` | 0% (`"0"`) | Prélevée sur le prix catalogue avant versement à l'ayant droit. Override possible par ayant droit (E11-004) |

**Section "Opérations"** :

| Paramètre | Champ DB | Valeur actuelle | Description |
|---|---|---|---|
| Email ops | `opsEmail` | `ops@timeless.film` | Destinataire des notifications internes (paiement, alertes livraison) |
| Expiration des demandes | `requestExpirationDays` | 30 jours | Délai avant expiration d'une demande non traitée |
| Seuil d'urgence | `requestUrgencyDaysBeforeStart` | 7 jours | Seuil pour marquer une demande/livraison comme urgente |

> **Note — mécanisme d'expiration** : le champ `requestExpirationDays` est configurable ici mais le mécanisme automatique d'expiration (cron/scheduled function qui passe les demandes `pending` en `expired` après le délai) est à implémenter dans E11-009 ou dans un ticket dédié.

**Comportement** :
- Modification avec confirmation obligatoire (dialog "Ces paramètres affecteront toutes les futures commandes")
- Aperçu en temps réel : "Avec ces paramètres, un film catalogué à 150 € sera affiché à **X €** pour l'exploitant, l'ayant droit recevra **Y €**, TIMELESS percevra **Z €**"
- Historique des modifications : table `platformSettingsHistory` (champ, ancienne/nouvelle valeur, date, admin)
- Les paramètres en vigueur au moment d'une commande sont **snapshotés** dans `orderItems` / `requests` — une modification ne change jamais rétroactivement les commandes passées

---

### E11-008 — Logs et audit trail
**Priorité** : P2 | **Taille** : M | **Statut** : ✅ Done

Page `/admin/logs` — journal des actions sensibles.

La table `auditLogs` existe déjà avec : `action`, `entityType`, `entityId`, `performedById`, `metadata` (JSON), `createdAt`.

**Actions loguées** :

| Action | Déclencheur |
|--------|-------------|
| `account.created` | Création d'un ayant droit (E11-003) |
| `account.suspended` | Suspension d'un compte (E11-003, E11-005) |
| `account.reactivated` | Réactivation d'un compte |
| `commission.updated` | Modification de commission par ayant droit (E11-004) |
| `settings.updated` | Modification des paramètres plateforme (E11-007) |
| `order.refunded` | Remboursement d'une commande (E11-006) |
| `delivery.status_changed` | Changement de statut de livraison (E10-002) |
| `api_token.revoked` | Révocation d'un token API par l'admin (E11-005) |
| `request.force_approved` | Approbation forcée d'une demande par l'admin (E11-009) |
| `request.force_rejected` | Rejet forcé d'une demande par l'admin (E11-009) |
| `request.cancelled` | Annulation d'une demande par l'admin (E11-009) |

**Interface** :
- Tableau chronologique (plus récent en premier)
- Colonnes : date/heure, admin, action (badge), entité (lien vers la fiche), détail (anciennes/nouvelles valeurs)
- Filtres : type d'action, admin, période
- Recherche par entité (ID ou nom)

---

### E11-009 — Vue et gestion des demandes ✅
**Priorité** : P1 | **Taille** : M | **Statut** : ✅ Done (partiel — listing, actions, status filter, urgency)

Page `/admin/requests` — toutes les demandes de booking de la plateforme.

Les demandes (`requests`) sont l'étape de validation pré-paiement (E06, E07). L'admin doit pouvoir superviser et intervenir en cas de blocage.

**Tableau des demandes** :

| Colonne | Source |
|---------|--------|
| N° | `requests.id` (tronqué) |
| Exploitant | `accounts.companyName` (via `exhibitorAccountId`) |
| Ayant droit | `accounts.companyName` (via `rightsHolderAccountId`) |
| Film | `films.title` |
| Cinéma | `cinemas.name` |
| Dates | `requests.startDate` → `requests.endDate` |
| Statut | `requests.status` (`pending` / `approved` / `rejected` / `cancelled` / `paid`) |
| Créée le | `requests.createdAt` |
| Urgence | Badge si `startDate - now < requestUrgencyDaysBeforeStart` |

**Fiche demande** (détail) :
- Récapitulatif complet : exploitant, ayant droit, film, cinéma, salle, dates, nb visionnages, prix snapshotté
- Historique des statuts (`bookingRequestStatusHistory`) : date, ancien → nouveau statut, qui a agi
- Lien vers la commande associée si `status = paid`

**Actions admin** :
- **Forcer l'approbation** : passe `status` à `approved` lorsque l'ayant droit ne répond pas. Log dans `auditLogs` avec `action: "request.force_approved"`. Email de notification à l'exploitant.
- **Forcer le rejet** : passe `status` à `rejected`. Log + email.
- **Annuler** : passe `status` à `cancelled`. Log + email à l'exploitant + ayant droit.

**Expiration automatique** :
- Cron ou scheduled function (ex: Vercel Cron, pg_cron) lancé quotidiennement
- Passe en `expired` toute demande `pending` dont `createdAt + requestExpirationDays < now()`
- Email de notification à l'exploitant ("votre demande a expiré, vous pouvez en refaire une")
- Log dans `auditLogs`

> Requiert l'ajout du statut `expired` dans `requestStatusEnum` et dans la machine à états.

Filtres : statut, exploitant, ayant droit, urgence, période.
Recherche par film ou cinéma.

---

### E11-010 — Catalogue films global
**Priorité** : P2 | **Taille** : M | **Statut** : ✅ Done

Page `/admin/films` — vue transversale de tous les films de la plateforme, tous ayants droits confondus.

E11-003 permet de voir le catalogue d'un ayant droit spécifique. Cette page offre une vue globale pour la supervision du catalogue.

**Tableau** :

| Colonne | Source |
|---------|--------|
| Titre | `films.title` |
| Ayant droit | `accounts.companyName` (via `rightsHolderAccountId`) |
| Année | `films.year` |
| Statut | `films.status` (`active` / `inactive` / `retired`) |
| TMDB | `films.tmdbMatchStatus` (badge `matched` / `unmatched` / `pending`) |
| Zones de prix | Count `filmPrices` |
| Commandes | Count `orderItems` pour ce film |

**Fiche film** (lecture seule) :
- Infos complètes : titre, réalisateur, année, synopsis, affiche, durée
- Statut TMDB + lien TMDB si matché
- Grille de prix par zone/pays
- Historique des commandes pour ce film
- Analytics : vues catalogue, ajouts panier, demandes (via `filmEvents`)

> L'admin ne modifie pas les films (c'est la responsabilité de l'ayant droit). La vue est en lecture seule.

Filtres : ayant droit, statut, match TMDB, avec/sans prix.
Recherche par titre ou réalisateur.

---

## Ordre d'implémentation recommandé

1. **E11-001** — Layout admin (prérequis de tout)
2. **E11-007** — Paramètres plateforme (critique — valeurs existantes, peu de code nouveau)
3. **E11-003** — Gestion ayants droits + **E11-004** commissions (création de comptes RH = flow business principal)
4. **E11-005** — Gestion exploitants
5. **E11-009** — Vue et gestion des demandes (supervision du workflow de validation)
6. **E11-006** — Vue commandes & remboursements
7. **E11-002** — Dashboard global (dernière passe — les données existent, c'est de la visualisation)
8. **E11-010** — Catalogue films global (P2, vue en lecture seule)
9. **E11-008** — Audit trail (P2, non bloquant)

> E10 (Livraison Opérationnelle) se branche après E11-001 : la vue livraisons (E10-002) s'intègre dans le layout admin.

---

## Implémentation

### E11-001 — Layout admin & navigation ✅
- Sidebar avec 9 items de navigation (Dashboard, Commandes, Demandes, Films, Exploitants, Ayants droits, Livraisons | Paramètres, Logs)
- Pages stub créées pour `/admin/requests` et `/admin/films`
- i18n (en/fr) pour tous les items de navigation
- Guard proxy.ts : `ADMIN_PATHS` mis à jour + tests unitaires (2 tests ajoutés)
- E2E : 3 tests (sidebar items visibles, navigation vers toutes les pages, redirect non-admin)

### E11-007 — Configuration globale des tarifs plateforme ✅
- Page `/admin/settings` avec formulaire complet (6 champs : marge, frais de livraison, commission, email ops, expiration, urgence)
- Aperçu en temps réel du pricing (calcul dynamique sur film 150€)
- Confirmation par dialog (`AlertDialog`) avant sauvegarde
- Historique des modifications avec table formatée (champ traduit, ancienne/nouvelle valeur, date)
- Server actions : validation Zod côté serveur, détection de diffs, transaction DB (update + historique)
- Service : `PlatformSettingsUpdate` interface dans `admin-settings-service.ts`
- Pure function extraction : `calculatePricing()` extrait dans `lib/pricing/calculations.ts` (safe pour client components)
- i18n (en/fr) pour tous les labels, erreurs, messages de confirmation
- E2E : 5 tests (affichage valeurs, preview dynamique, update avec confirmation, historique, persistance)

### E11-003 — Gestion des ayants droits ✅ + E11-004 — Commissions ✅
- Page `/admin/rights-holders` avec tableau paginé (nom, pays, films, Stripe Connect, commission, volume, statut)
- Service `admin-accounts-service.ts` : `listAccountsForAdmin()` (paginated, search, status filter, subquery counts), `suspendAccount()`, `reactivateAccount()`, `updateAccountCommissionRate()`, `getAccountDetail()`
- Server actions : `getRightsHoldersPaginated`, `suspendRightsHolderAction`, `reactivateRightsHolderAction`, `updateCommissionRateAction`
- Client component `rights-holder-list.tsx` : debounced search (300ms), skeleton loading, pagination, dropdown row actions, country name display via `getCountryOptions()`
- Suspend/reactivate : confirmation dialog, audit log in DB transaction, toast feedback, status badge update
- Commission edit : percentage input dialog (0-100), converts to decimal string, audit log with `oldRate`/`newRate` metadata
- Commission display : shows "X% (default)" when `commissionRate` is null, else actual rate
- i18n (en/fr) : 30+ keys in `admin.rightsHolders` namespace
- E2E : 4 tests (listing, suspend/reactivate flow, commission edit with DB verification, search filtering)

### E11-005 — Gestion des exploitants ✅
- Page `/admin/exhibitors` avec tableau paginé (nom, pays, cinémas, commandes, onboarding, statut)
- Réutilise `listAccountsForAdmin()` avec sous-requêtes `cinemaCount` et `orderCount` ajoutées au service
- Server actions : `getExhibitorsPaginated`, `suspendExhibitorAction`, `reactivateExhibitorAction`
- Client component `exhibitor-list.tsx` : même pattern que `rights-holder-list.tsx` (search, skeleton, pagination, suspend/reactivate dialog)
- Pas de commission ni Stripe Connect pour les exploitants — colonnes simples
- Helper E2E : `createExhibitorContext()` ajouté dans `e2e/helpers/exhibitor.ts`
- i18n (en/fr) : 20+ keys dans `admin.exhibitors` namespace
- E2E : 3 tests (listing, suspend/reactivate flow, search filtering)

### E11-009 — Vue et gestion des demandes ✅
- Page `/admin/requests` avec tableau paginé (ID, exploitant, ayant droit, film, dates, montant, statut, créée le, urgence)
- Service `admin-requests-service.ts` : `listRequestsForAdmin()` (paginated, search across film/cinema/exhibitor, status filter, urgency calculation), `forceApproveRequest()`, `forceRejectRequest()`, `adminCancelRequest()`
- Search uses EXISTS subqueries for film title, cinema name, exhibitor company name
- Urgency: `startDate - now <= urgencyDays AND status NOT IN (paid, rejected, cancelled)` — shows AlertTriangle icon
- Server actions : `getRequestsPaginated`, `forceApproveRequestAction`, `forceRejectRequestAction`, `adminCancelRequestAction`
- Client component `request-list.tsx` : debounced search, status filter dropdown (Select component), colored status badges, urgency indicator, action dialogs (approve/reject/cancel), pagination
- Actions: Force approve (pending→approved), Force reject (pending→rejected), Cancel (pending→cancelled) — all via `transitionRequestStatus()` + audit log
- i18n (en/fr) : 50+ keys dans `admin.requests` namespace (columns, statuses, actions, dialog texts)
- E2E : 4 tests (listing, force approve, cancel, status filter)

### E11-006 — Vue des commandes & remboursements ✅
- Page `/admin/orders` avec tableau paginé (N° commande ORD-XXXXXX, exploitant, date, nombre de films, total, statut)
- Service `admin-orders-service.ts` : `listOrdersForAdmin()` (paginated, search by order number or exhibitor name, status filter), `getOrderDetailForAdmin()`, `refundOrder()` (full refund flow)
- Refund flow : vérifie statut (paid/processing), fenêtre 48h, `stripe.refunds.create()` sur PaymentIntent, `stripe.transfers.createReversal()` pour chaque item, reset delivery statuses, audit log `order.refunded`
- Server actions : `getOrdersPaginated`, `getOrderDetailAction`, `refundOrderAction`
- Client component `order-list.tsx` : search debounced, status filter dropdown (Select), colored status badges, refund dialog with mandatory reason, pagination
- Refund conditionnel : bouton visible uniquement si paid/processing ET < 48h
- i18n (en/fr) : searchPlaceholder, empty, noResults, filter, refundSuccess, cancel, pagination, error
- E2E : 3 tests (listing, search, status filter)

### E11-002 — Dashboard global ✅
- Page `/admin/dashboard` avec 8 KPI cards en 2 rangées
- Rangée primaire : Revenue (Timeless), Transactions, Pending requests, Pending deliveries
- Rangée secondaire : Active exhibitors, Active rights holders, Active films, Pending onboardings
- Service `admin-dashboard-service.ts` : `getDashboardKpis()` — 8 requêtes DB parallèles (SUM, COUNT)
- `formatAmount()` de `lib/pricing/format.ts` pour affichage monétaire
- Icônes Lucide par KPI (DollarSign, ShoppingCart, ClipboardList, Truck, Store, Users, Film, Package)
- Server Component (pas de client state — données SSR)
- i18n (en/fr) : `admin.dashboard.metrics.*` (8 clés)
- E2E : 2 tests (KPI cards visibles, valeurs reflètent les données de test)

### E11-010 — Catalogue films global ✅
- Page `/admin/films` avec tableau paginé (titre, ayant droit, année, statut, TMDB, zones de prix, commandes)
- Service `admin-films-service.ts` : `listFilmsForAdmin()` (paginated, search by title/director via ILIKE + unnest, status filter, tmdbMatchStatus filter, scalar subqueries for priceZoneCount and orderCount)
- Server actions : `getFilmsPaginated`
- Client component `film-list.tsx` : debounced search, status filter dropdown (Select), colored badges for status and TMDB match status, pagination
- Vue lecture seule — pas d'actions de modification (responsabilité de l'ayant droit)
- i18n (en/fr) : columns, status, tmdb match statuses, search, empty, noResults, filter, pagination, error
- E2E : 3 tests (listing, search, rights holder name in row)

### E11-008 — Logs et audit trail ✅
- Page `/admin/logs` avec tableau paginé chronologique (plus récent en premier)
- Service `admin-audit-service.ts` : `listAuditLogs()` (paginated, search by entityId/action/metadata, action filter, date range), `getDistinctActions()` pour le dropdown de filtre
- Server actions : `getAuditLogsPaginated`
- Client component `audit-log-list.tsx` : debounced search, action filter dropdown (Select dynamique), colored badges per action type, entity display (type:id truncated), performer name via subquery join on `better_auth_users`, metadata formatting (JSON parse)
- Colonnes : date/heure, action (badge), entité (type:id), admin (nom), détails (metadata)
- i18n (en/fr) : columns, search, empty, noResults, filter, pagination, error
- E2E : 4 tests (affichage actions, nom du performer, search, filtre par action)
