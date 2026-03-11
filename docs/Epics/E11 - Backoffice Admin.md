# E11 — Backoffice Admin

**Phase** : P3
**Statut** : ⬜ À faire

---

## Contexte

Le backoffice est réservé aux membres de l'équipe TIMELESS (`accountType = admin`). Il centralise :
- La supervision de l'activité de la plateforme (dashboard)
- La gestion des comptes ayants droits et exploitants
- La configuration des commissions et des paramètres tarifaires
- Le suivi opérationnel des livraisons (intégration E10)
- L'audit trail des actions sensibles

### Navigation (sidebar admin)

La sidebar admin contient déjà les routes suivantes :
- `/dashboard` — Dashboard global
- `/exhibitors` — Gestion des exploitants
- `/rights-holders` — Gestion des ayants droits
- `/deliveries` — Supervision des livraisons
- `/settings` — Paramètres de la plateforme
- `/logs` — Audit trail

### Modèle de données

Modèles pertinents pour cette épic :
- `accounts` : `type`, `status`, `companyName`, `country`, `stripeConnectAccountId`, `stripeConnectOnboardingComplete`, `commissionRate`
- `platformSettings` : ligne unique (`id = "global"`), contient `platformMarginRate`, `deliveryFees`, `defaultCommissionRate`, `opsEmail`, `requestExpirationDays`, `requestUrgencyDaysBeforeStart`
- `platformSettingsHistory` : audit des modifications de paramètres
- `auditLogs` : journal des actions admin (`action`, `entityType`, `entityId`, `performedById`, `metadata`)

---

## Tickets

### E11-001 — Dashboard global
**Priorité** : P1 | **Taille** : M

Vue principale du backoffice (`/dashboard`). Donne une vue d'ensemble de l'activité de la plateforme.

**Métriques (cartes en haut de page)** :

| Métrique | Calcul | Période |
|---|---|---|
| Volume de transactions | Somme `orders.total` | Aujourd'hui / Ce mois / Cumulé |
| Revenus TIMELESS | Somme `orderItems.timelessAmount` | Ce mois |
| Commandes actives | Nb commandes avec `status = processing` | Temps réel |
| Livraisons en attente | Nb `orderItems` avec `deliveryStatus ∈ {pending, in_progress}` | Temps réel |
| Demandes en attente | Nb `requests` avec `status = pending` | Temps réel |
| Exploitants actifs | Nb comptes `type = exhibitor`, `status = active` | Temps réel |
| Ayants droits actifs | Nb comptes `type = rights_holder`, `status = active` | Temps réel |

**Graphiques** :
- Évolution des transactions sur les 30 derniers jours (courbe, montant par jour)
- Top 5 films les plus réservés du mois (barres)
- Top 5 exploitants par volume du mois (liste)

**Filtres globaux** :
- Sélecteur de période : "7 derniers jours" / "30 derniers jours" / "Ce mois" / "Mois précédent" — appliqué aux graphiques

**Critères d'acceptance** :
- Les métriques "temps réel" reflètent l'état actuel de la DB (pas de cache)
- Les graphiques sont calculés côté serveur (pas de Client Component sauf si interactivité requise)
- Le dashboard se charge en moins de 2 secondes

---

### E11-002 — Gestion des ayants droits
**Priorité** : P0 | **Taille** : L

Vue : `/rights-holders`.

#### Liste des ayants droits

Tableau paginé (20 par page) avec les colonnes :

| Colonne | Source |
|---|---|
| Nom | `accounts.companyName` |
| Pays | `accounts.country` |
| Stripe Connect | Badge : "Complet" (vert) / "Incomplet" (orange) basé sur `stripeConnectOnboardingComplete` |
| Commission | `accounts.commissionRate` (si null : valeur globale `platformSettings.defaultCommissionRate`) |
| Films | Nb films dans le catalogue de cet ayant droit |
| Volume | Somme `orderItems.rightsHolderAmount` (tous temps) |
| Statut | Badge : "Actif" / "Suspendu" |
| Actions | Voir / Modifier / Suspendre |

**Recherche** : par nom de société (debounce 300ms).

**Filtres** : Statut (Tous / Actif / Suspendu), Stripe Connect (Tous / Complet / Incomplet).

#### Actions disponibles

**Créer un ayant droit** (bouton "Nouveau") :
- Formulaire : raison sociale, pays, email de contact
- Envoi d'un email d'invitation pour créer le compte et compléter l'onboarding Stripe Connect
- Le compte est créé avec `status = active`, `stripeConnectOnboardingComplete = false`

**Fiche d'un ayant droit** (slide-over ou page `/rights-holders/[accountId]`) :

Onglets :
1. **Informations** : raison sociale, pays, adresse, email, téléphone, numéro TVA
2. **Stripe Connect** : statut d'onboarding + lien vers le dashboard Stripe Connect
3. **Catalogue** : liste des films (titre, prix catalogue, statut) — lien vers le catalogue
4. **Transactions** : liste des commandes (film, cinéma, date, montant net, statut)
5. **Commission** : valeur actuelle + historique des modifications (cf. E11-004)

**Modifier** : raison sociale, commission (cf. E11-004).

**Suspendre un compte** :
- Confirmation obligatoire ("Suspendre [Nom] ? Les films seront masqués du catalogue.")
- Effets :
  - `accounts.status` = `suspended`
  - Les films de cet ayant droit ne s'affichent plus dans le catalogue exploitant
  - Les commandes en cours ne sont pas affectées (livraisons se poursuivent)
  - L'ayant droit ne peut plus se connecter (accès bloqué par proxy.ts)
- Entrée dans `auditLogs` : `action: "account.suspended"`, `entityType: "account"`, `entityId`

**Réactiver** : inverse de la suspension.

**Critères d'acceptance** :
- La suspension est effective immédiatement (pas de délai de cache)
- Les films suspendus disparaissent du catalogue sans rechargement forcé côté exploitant

---

### E11-003 — Gestion des exploitants
**Priorité** : P1 | **Taille** : M

Vue : `/exhibitors`.

#### Liste des exploitants

Tableau paginé avec les colonnes :

| Colonne | Source |
|---|---|
| Nom | `accounts.companyName` |
| Pays | `accounts.country` |
| Type | `accounts.cinemaType` (libellé humanisé) |
| Cinémas | Nb cinémas liés à ce compte |
| Volume | Somme `orders.total` pour cet exploitant |
| Statut | Badge : "Actif" / "Suspendu" |
| Actions | Voir / Suspendre |

**Recherche** : par nom de société.

**Filtres** : Statut (Tous / Actif / Suspendu).

#### Fiche d'un exploitant (`/exhibitors/[accountId]`)

- **Informations** : raison sociale, pays, type, email de contact, TVA
- **Cinémas** : liste des cinémas (nom, ville, nb salles) avec lien vers la fiche cinéma
- **Commandes** : historique des commandes (numéro, date, total, statut, livraison)
- **Membres** : liste des utilisateurs du compte (nom, email, rôle)

**Suspendre / Réactiver** : même logique que pour les ayants droits.

**Pas de création manuelle** : les exploitants s'inscrivent eux-mêmes via l'onboarding.

**Critères d'acceptance** :
- La fiche est accessible depuis la liste et depuis les commandes associées
- La suspension empêche immédiatement l'accès de tous les membres du compte

---

### E11-004 — Configuration des commissions par ayant droit
**Priorité** : P0 | **Taille** : S

Accessible depuis la fiche d'un ayant droit (onglet "Commission").

**Affichage** :
- Commission actuelle : valeur de `accounts.commissionRate` ou "Par défaut (X%)" si null
- Historique : tableau des modifications (date, ancienne valeur, nouvelle valeur, admin)

**Modification** :
- Champ numérique (0–100, avec 1 décimale — ex : 12.5%)
- Bouton "Rétablir la valeur par défaut" (remet `commissionRate = null`)
- Confirmation avant sauvegarde
- Au moment de la sauvegarde :
  - `accounts.commissionRate` est mis à jour (format décimal : "0.125")
  - Entrée dans `auditLogs` : `action: "commission.updated"`, `metadata: { oldValue, newValue, accountId }`

**Règle métier** :
- La modification ne s'applique qu'aux nouvelles transactions
- Les commandes passées utilisent le taux snapshoté dans `orderItems.commissionRate`

**Critères d'acceptance** :
- L'historique affiche les 20 dernières modifications
- La valeur "Par défaut" reflète toujours la valeur actuelle de `platformSettings.defaultCommissionRate`

---

### E11-005 — Supervision des livraisons
**Priorité** : P0 | **Taille** : S

Vue : `/deliveries`.

Cette vue intègre l'interface complète de suivi définie dans **E10-002**. Le composant est partagé — même code, même comportement.

**Spécificités de l'intégration dans E11** :
- La page est accessible uniquement aux admins TIMELESS (protégée par `proxy.ts`)
- Lien dans la sidebar avec icône et compteur de livraisons "À traiter" en badge
- Le badge affiche le nombre d'items `deliveryStatus = pending` en temps réel (chargé côté serveur à chaque visite)

**Critères d'acceptance** :
- Le badge de la sidebar disparaît quand toutes les livraisons sont traitées
- Un non-admin ne peut pas accéder à `/deliveries` (redirection vers `/dashboard` ou 403)

---

### E11-006 — Logs et audit trail
**Priorité** : P2 | **Taille** : M

Vue : `/logs`.

Affiche le contenu de la table `auditLogs`, enrichi des noms des admins (via `performedById`).

**Colonnes** :
| Colonne | Source |
|---|---|
| Date | `auditLogs.createdAt` |
| Admin | Nom de l'utilisateur (`performedById`) |
| Action | Libellé humanisé de `auditLogs.action` |
| Entité | `auditLogs.entityType` + lien vers l'entité |
| Détails | `auditLogs.metadata` affiché en JSON lisible ou bullet list |

**Actions tracées** (non exhaustif) :

| Code action | Description |
|---|---|
| `account.suspended` | Suspension d'un compte |
| `account.reactivated` | Réactivation d'un compte |
| `commission.updated` | Modification du taux de commission |
| `settings.updated` | Modification d'un paramètre plateforme |
| `delivery.delivered` | Livraison confirmée |
| `delivery.status_updated` | Changement de statut d'une livraison |

**Filtres** :
- Type d'action : dropdown multi-select
- Admin : dropdown
- Période : date de début / date de fin

**Pagination** : 50 entrées par page, tri par date décroissante.

**Export** : bouton "Exporter CSV" — toutes les entrées de la période filtrée.

**Critères d'acceptance** :
- Les logs sont en lecture seule (jamais modifiables)
- L'export CSV inclut toutes les colonnes visibles
- Les entrées sont créées automatiquement par le système — jamais manuellement

---

### E11-007 — Configuration globale des paramètres plateforme
**Priorité** : P0 | **Taille** : M

Vue : `/settings`.

Interface d'administration de la table `platformSettings` (ligne unique `id = "global"`).

**Paramètres modifiables** :

| Paramètre | Champ DB | Type | Défaut | Description |
|---|---|---|---|---|
| Marge plateforme | `platformMarginRate` | % | 20% | Appliquée sur le prix catalogue de tous les films |
| Frais de livraison | `deliveryFees` | Montant (EUR) | 50,00 € | Ajoutés par film dans chaque commande |
| Commission par défaut | `defaultCommissionRate` | % | 10% | Appliquée si pas d'override sur l'ayant droit |
| Email opérations | `opsEmail` | Email | ops@timeless.film | Destinataire des notifications internes (E10-001, E10-004) |
| Expiration des demandes | `requestExpirationDays` | Jours | 30 | Délai avant expiration auto d'une demande (futur — E06-005) |
| Seuil d'urgence livraison | `requestUrgencyDaysBeforeStart` | Jours | 7 | Nb de jours avant diffusion déclenchant l'alerte (E10-004) |

**UX de modification** :
- Chaque paramètre est éditable via un champ inline ou un formulaire dédié
- Confirmation obligatoire avant sauvegarde ("Êtes-vous sûr ? Cette modification affectera les prochaines commandes.")
- Après sauvegarde : entrée dans `auditLogs` (`action: "settings.updated"`) + entrée dans `platformSettingsHistory`

**Aperçu en temps réel** :
- Sous les champs de tarification, un exemple : "Avec ces paramètres, un film catalogué à 150,00 € sera affiché à [150 × (1 + marge)] € à l'exploitant, et l'ayant droit recevra [150 × (1 - commission)] €."
- L'aperçu se met à jour dès que l'utilisateur modifie une valeur (avant confirmation)

**Historique** :
- Section "Historique des modifications" : tableau des 20 dernières entrées de `platformSettingsHistory`
- Colonnes : Date, Admin, Paramètre modifié, Ancienne valeur, Nouvelle valeur

**Règle métier** :
- Les paramètres en vigueur au moment d'une commande sont snapshotés dans `orderItems` (ne changent jamais rétroactivement)

**Critères d'acceptance** :
- La modification ne s'applique qu'aux nouvelles commandes
- L'historique est visible sans quitter la page
- Toute modification est tracée dans `auditLogs` ET `platformSettingsHistory`

---

### E11-008 — Gestion des administrateurs TIMELESS
**Priorité** : P1 | **Taille** : S

Depuis la page `/settings` (section "Équipe") ou une page dédiée `/settings/team`.

**Affichage** :
- Liste des membres du compte admin TIMELESS : nom, email, rôle (`owner` / `admin` / `member`)
- Date d'ajout

**Actions** :
- **Inviter un nouvel admin** : formulaire avec email + rôle → envoi d'un email d'invitation via le mécanisme d'invitation existant (`invitations` table)
- **Modifier le rôle** d'un membre existant
- **Révoquer l'accès** : suppression du membre du compte admin (avec confirmation)

**Contraintes** :
- Au moins un `owner` doit rester sur le compte (impossible de révoquer le dernier owner)
- Seuls les `owner` peuvent inviter ou révoquer

**Critères d'acceptance** :
- L'invitation utilise le même flow que les invitations exploitants/ayants droits déjà implémentées
- Un admin révoqué ne peut plus se connecter dès la révocation (sans délai de cache)

---

## Récapitulatif

| Ticket | Titre | Priorité | Taille | Statut |
|---|---|---|---|---|
| E11-001 | Dashboard global | P1 | M | ⬜ À faire |
| E11-002 | Gestion des ayants droits | P0 | L | ⬜ À faire |
| E11-003 | Gestion des exploitants | P1 | M | ⬜ À faire |
| E11-004 | Configuration des commissions par ayant droit | P0 | S | ⬜ À faire |
| E11-005 | Supervision des livraisons | P0 | S | ⬜ À faire |
| E11-006 | Logs et audit trail | P2 | M | ⬜ À faire |
| E11-007 | Configuration globale des paramètres plateforme | P0 | M | ⬜ À faire |
| E11-008 | Gestion des administrateurs TIMELESS | P1 | S | ⬜ À faire |
