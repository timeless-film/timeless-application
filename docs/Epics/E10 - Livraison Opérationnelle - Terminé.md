# E10 — Livraison Opérationnelle

**Phase** : P3
**Dépendance** : [[E11 - Backoffice Admin]] ✅ (le backoffice admin existe — layout, navigation, settings, orders, audit logs)

---

## Contexte

Après un paiement validé, la livraison du DCP et des KDM n'est pas automatisée — c'est l'équipe opérations de TIMELESS qui prend le relais en contactant le laboratoire concerné. La plateforme doit leur fournir toutes les informations nécessaires et permettre de suivre le statut de chaque livraison.

---

## Infrastructure existante

L'essentiel de l'infrastructure est en place grâce aux epics précédentes :

| Composant | Fichier | Détail |
|-----------|---------|--------|
| Enum `delivery_status` | `schema/orders.ts` | `"pending"` / `"in_progress"` / `"delivered"` |
| Champ `orderItems.deliveryStatus` | `schema/orders.ts` | Défaut `"pending"` — initialisé automatiquement à la création d'une commande |
| Champ `orderItems.deliveryNotes` | `schema/orders.ts` | Notes ops (texte libre, nullable) |
| Champ `orderItems.deliveredAt` | `schema/orders.ts` | Timestamp de livraison (nullable) |
| Email ops après paiement | `email/order-emails.ts` | `sendOpsOrderNotificationEmail()` — envoyé depuis le webhook `checkout.session.completed` |
| Config `opsEmail` | `schema/settings.ts` | Configurable via `/admin/settings` (E11-007 ✅) |
| Config `requestUrgencyDaysBeforeStart` | `schema/settings.ts` | Seuil d'urgence des demandes (défaut 7 jours) |
| KPI "Livraisons à traiter" | `admin-dashboard-service.ts` | `pendingDeliveries` affiché sur le dashboard admin (E11-002 ✅) |
| Navigation "Livraisons" | `admin/layout.tsx` | Lien dans la sidebar admin avec icône `truck` |
| Page stub `/admin/deliveries` | `admin/deliveries/page.tsx` | Titre seul — à implémenter |
| Badge livraison (lecture seule) | `admin/orders/[orderId]` | Statut affiché par item dans le détail commande, pas de mise à jour |
| Remboursement → reset livraisons | `admin-orders-service.ts` | `refundOrder()` remet tous les `deliveryStatus` à `"pending"` + efface notes |
| Audit log `delivery.status_changed` | `schema/settings.ts` | Action prévue dans `auditLogs` — pas encore utilisée |
| Traductions `deliveryStatus.*` | `messages/en.json` / `fr.json` | Labels `pending` / `in_progress` / `delivered` déjà traduits |

---

## Décisions d'architecture

1. **Transition `orders.status`** : `paid` → `processing` automatiquement quand le premier `orderItem` passe à `in_progress`. `processing` → `delivered` quand **tous** les items sont `delivered`.
2. **Numéro de commande labo** : nouveau champ dédié `orderItems.labOrderNumber` (text, nullable) **en plus** de `deliveryNotes` (texte libre). Migration DB requise.
3. **Notes éditables sur tous les statuts** : y compris `delivered` (ex : "KDM expiré le 15/04, renouvellement demandé").
4. **Seuil d'urgence livraison séparé** : nouveau champ `platformSettings.deliveryUrgencyDaysBeforeStart` (défaut 5 jours), distinct de `requestUrgencyDaysBeforeStart` (demandes). Éditable dans `/admin/settings`.
5. **Pas de notification ayant droit** : l'ayant droit n'est notifié que pour les paiements et demandes à traiter, pas pour les livraisons.

---

## Tickets

### E10-001 — Enrichir la notification ops après paiement
**Priorité** : P0 | **Taille** : S | **Statut** : ✅ Done

L'email ops est envoyé (E08 ✅) mais manque de détails pour que l'équipe puisse agir sans aller dans le backoffice.

**État actuel** : `sendOpsOrderNotificationEmail()` envoie le n° de commande, l'exploitant, le nombre de films et le total — pas assez pour contacter un labo.

**Enrichir l'email ops avec** (par film de la commande) :
- Titre du film
- Ayant droit (raison sociale)
- Cinéma + salle
- Dates de diffusion (début → fin) et nombre de visionnages
- Lien direct vers le détail de la commande (`/admin/orders/{orderId}`)

**Mise à jour de la signature** :
```typescript
interface OpsOrderNotificationParams {
  opsEmail: string;
  orderNumber: number;
  exhibitorCompanyName: string;
  items: Array<{
    filmTitle: string;
    rightsHolderName: string;
    cinemaName: string;
    roomName: string;
    startDate: string | null;
    endDate: string | null;
    screeningCount: number;
  }>;
  total: number;
  currency: string;
  orderId: string; // Pour le lien direct
}
```

**Fichiers impactés** :
- `src/lib/email/order-emails.ts` — enrichir le template HTML et la signature
- `src/app/api/webhooks/stripe/route.ts` — passer les items détaillés à la fonction

---

### E10-002 — Interface de suivi des livraisons (backoffice)
**Priorité** : P0 | **Taille** : L | **Statut** : ✅ Done

Implémenter la page `/admin/deliveries` (stub existant) — vue dédiée au suivi opérationnel des livraisons.

#### Migration DB

Ajouter à `orderItems` dans `schema/orders.ts` :
```typescript
labOrderNumber: text("lab_order_number"), // Numéro de commande labo (optionnel)
```

Ajouter à `platformSettings` dans `schema/settings.ts` :
```typescript
deliveryUrgencyDaysBeforeStart: integer("delivery_urgency_days_before_start").notNull().default(5),
```

Puis `pnpm db:generate` + `pnpm db:migrate`.

#### Mise à jour `/admin/settings` (E11-007)

Ajouter le champ **Seuil d'urgence livraison** dans la section "Opérations" de la page settings :
- Label : "Delivery urgency threshold" / "Seuil d'urgence de livraison"
- Input : entier (jours), validation Zod ≥ 1
- Comportement identique aux autres champs (confirmation, historique, audit log)

**Fichiers impactés** :
- `src/app/[locale]/admin/settings/platform-settings-form.tsx` — ajouter le champ
- `src/app/[locale]/admin/settings/actions.ts` — ajouter la validation et la mise à jour
- `messages/en.json` / `messages/fr.json` — traduction du label

#### Service `admin-delivery-service.ts`

Créer `src/lib/services/admin-delivery-service.ts` :

```typescript
// Listing paginé des orderItems avec jointures (film, cinema, room, RH, order)
listDeliveriesForAdmin(options: {
  page: number;
  limit: number;
  status?: "pending" | "in_progress" | "delivered";
  search?: string; // recherche sur film title, cinema name, order number
  rightsHolderAccountId?: string;
  urgencyOnly?: boolean; // startDate - today <= seuil deliveryUrgencyDaysBeforeStart
}) → { deliveries: AdminDeliveryRow[], total: number }

// Mise à jour du statut d'un item
updateDeliveryStatus(orderItemId: string, params: {
  status: "pending" | "in_progress" | "delivered";
  notes?: string;
  labOrderNumber?: string;
  adminUserId: string;
}) → void

// Mise à jour des notes uniquement (sans changer le statut)
updateDeliveryNotes(orderItemId: string, params: {
  notes: string;
  labOrderNumber?: string;
  adminUserId: string;
}) → void

// Valider les transitions autorisées
// pending → in_progress | delivered
// in_progress → delivered | pending (rollback)
// delivered → (aucune transition de statut, mais notes éditables)
```

**Logique de transition `orders.status`** (dans `updateDeliveryStatus`) :
- Quand un item passe à `in_progress` → si `orders.status` est `paid`, le passer à `processing`
- Quand un item passe à `delivered` → vérifier si **tous** les items de la commande sont `delivered`, si oui passer `orders.status` à `delivered`

**Type `AdminDeliveryRow`** :

| Champ | Source |
|-------|--------|
| `orderItemId` | `orderItems.id` |
| `orderNumber` | `orders.orderNumber` (formaté `ORD-000042`) |
| `orderId` | `orders.id` |
| `filmTitle` | `films.title` |
| `filmId` | `films.id` |
| `cinemaName` | `cinemas.name` |
| `roomName` | `rooms.name` |
| `rightsHolderName` | `accounts.companyName` (via `rightsHolderAccountId`) |
| `startDate` | `orderItems.startDate` |
| `endDate` | `orderItems.endDate` |
| `screeningCount` | `orderItems.screeningCount` |
| `deliveryStatus` | `orderItems.deliveryStatus` |
| `deliveryNotes` | `orderItems.deliveryNotes` |
| `labOrderNumber` | `orderItems.labOrderNumber` |
| `deliveredAt` | `orderItems.deliveredAt` |
| `paidAt` | `orders.paidAt` |
| `urgencyDays` | Calculé : `startDate - today` (en jours, null si pas de `startDate`) |

#### Server actions `admin/deliveries/actions.ts`

```typescript
"use server"

// Listing paginé
getDeliveriesPaginated(search, status, rightsHolderId, urgencyOnly, page, limit)
  → appel admin-delivery-service.listDeliveriesForAdmin()

// Mise à jour du statut
updateDeliveryStatusAction(orderItemId, status, notes?, labOrderNumber?)
  → 1. Auth admin
  → 2. Validation Zod (orderItemId uuid, status enum, notes string optional, labOrderNumber string optional)
  → 3. Appel admin-delivery-service.updateDeliveryStatus()
  → 4. Si status = "delivered" : envoyer email exploitant (E10-003)
  → 5. Log dans auditLogs : action "delivery.status_changed", metadata { orderItemId, oldStatus, newStatus, notes, labOrderNumber }
  → 6. Return { success: true }

// Mise à jour des notes uniquement (y compris sur items livrés)
updateDeliveryNotesAction(orderItemId, notes, labOrderNumber?)
  → 1. Auth admin
  → 2. Validation Zod
  → 3. Appel admin-delivery-service.updateDeliveryNotes()
  → 4. Return { success: true }
```

#### Page `/admin/deliveries`

**Tableau** (suit les patterns `table-fixed` + skeleton loading de E11) :

| Colonne | Largeur | Contenu |
|---------|---------|---------|
| Film | 18% | Titre du film |
| Commande | 10% | `ORD-000042` (lien vers `/admin/orders/{orderId}`) |
| Cinéma / Salle | 16% | Nom cinéma + nom salle |
| Ayant droit | 14% | Raison sociale |
| Diffusion | 10% | Date début (ou "—" si non définie) |
| N° labo | 10% | `labOrderNumber` (ou "—") |
| Urgence | 7% | Badge : `J-X` (vert > seuil, jaune seuil÷2–seuil, rouge ≤ seuil÷2, noir "Dépassé" si < 0) |
| Statut | 7% | Badge `pending` / `in_progress` / `delivered` |
| Actions | 8% | Boutons de changement de statut |

**Onglets** (comme les pages admin existantes) :
- **À traiter** : `deliveryStatus = "pending"` (défaut)
- **En cours** : `deliveryStatus = "in_progress"`
- **Livrées** : `deliveryStatus = "delivered"`
- **Toutes** : pas de filtre

**Actions par item** :
- **"Prendre en charge"** : `pending` → `in_progress` — dialog de confirmation avec champs notes + n° labo optionnels
- **"Marquer livré"** : `pending` ou `in_progress` → `delivered` — dialog de confirmation avec champs notes + n° labo optionnels + date de livraison (défaut : maintenant)
- **"Éditer notes"** : ouvre un dialog pour éditer `deliveryNotes` (textarea) et `labOrderNumber` (text input) — disponible sur **tous les statuts**, y compris `delivered`

**Indicateur d'urgence** :
- Calculé à partir de `startDate - today` et du seuil `deliveryUrgencyDaysBeforeStart` (défaut 5 jours, configurable dans `/admin/settings`)
- Tri par défaut : les plus urgents en premier (les dates de début les plus proches)

**Recherche** : sur le titre du film, le nom du cinéma, le numéro de commande, le n° de commande labo. Pattern existant : garder le contenu visible pendant la recherche, `Loader2` dans l'input.

**Pagination** : `?page=1&limit=20` — pattern existant des tables admin.

**Fichiers à créer** :
- `src/lib/services/admin-delivery-service.ts` — service
- `src/app/[locale]/admin/deliveries/actions.ts` — server actions
- `src/app/[locale]/admin/deliveries/page.tsx` — remplacer le stub
- `src/components/admin/delivery-list.tsx` — composant client (tableau + filtres + onglets)
- Traductions `admin.deliveries.*` dans `messages/en.json` et `messages/fr.json`

---

### E10-003 — Notification au cinéma à la livraison
**Priorité** : P0 | **Taille** : S | **Statut** : ✅ Done

Déclenché automatiquement quand un admin passe un item en statut `delivered` (E10-002).

**Email** :

Créer `sendDeliveryConfirmationEmail()` dans `src/lib/email/order-emails.ts` :

```typescript
interface DeliveryConfirmationParams {
  recipientEmails: string[]; // owner + admin du compte exploitant
  filmTitle: string;
  cinemaName: string;
  roomName: string;
  orderNumber: number;
  deliveryNotes: string | null; // Notes saisies par l'ops (si présentes)
  deliveredAt: Date;
}
```

**Destinataires** : tous les `accountMembers` avec rôle `owner` ou `admin` du compte exploitant de la commande (via `orders.exhibitorAccountId` → `accountMembers` → `betterAuthUsers.email`).

**Contenu de l'email** :
- Sujet : `Livraison confirmée — {filmTitle}`
- Corps : film livré, cinéma/salle, date de livraison, notes techniques (si saisies), lien vers l'historique des commandes (`/orders`)

**Mise à jour du statut côté exploitant** :
- Quand le premier item passe à `in_progress`, passer `orders.status` de `paid` à `processing`
- Quand **tous** les items d'une commande sont `delivered`, passer `orders.status` à `delivered`
- Visible dans la page `/orders` de l'exploitant (le badge reflète le statut courant)

**Fichiers impactés** :
- `src/lib/email/order-emails.ts` — nouvelle fonction `sendDeliveryConfirmationEmail()`
- `src/lib/services/admin-delivery-service.ts` — logique de transition `orders.status` (`paid` → `processing` → `delivered`)
- `src/app/[locale]/admin/deliveries/actions.ts` — appeler l'email après `updateDeliveryStatus("delivered")`

---

### E10-004 — Alertes de retard
**Priorité** : P2 | **Taille** : S | **Statut** : ✅ Done

Alerte proactive quand une livraison risque de ne pas être prête à temps.

**Déclenchement** : cron quotidien (ou Next.js cron via Vercel) — si un `orderItem` a :
- `deliveryStatus` ∈ `{ "pending", "in_progress" }`
- `startDate` définie
- `startDate - today` ≤ seuil `platformSettings.deliveryUrgencyDaysBeforeStart` (défaut 5 jours)

**Actions** :
- **Email récapitulatif** à `opsEmail` : liste des livraisons en retard ou proches du retard (groupées par urgence)
- **Flag visuel** dans `/admin/deliveries` : badge rouge "Urgent" ou "Dépassé" (déjà prévu dans E10-002 via le calcul d'urgence)

**Implémentation** :
- Route API cron : `src/app/api/cron/delivery-alerts/route.ts`
- Protégée par un secret (`CRON_SECRET`) vérifié dans le header `Authorization`
- Requête sur `deliveryUrgencyDaysBeforeStart` (lu depuis `platformSettings`)
- Nouvel email : `sendDeliveryAlertEmail()` dans `src/lib/email/order-emails.ts`

> Note : si hébergé sur Vercel, configurer dans `vercel.json` : `{ "crons": [{ "path": "/api/cron/delivery-alerts", "schedule": "0 7 * * *" }] }`. Sinon, cron externe (GitHub Actions, ou service tiers).

---

### E10-005 — Tests E2E du workflow de livraison
**Priorité** : P1 | **Taille** : M | **Statut** : ✅ Done

Tests Playwright couvrant l'ensemble du workflow de livraison.

#### Tests unitaires (`src/lib/services/__tests__/admin-delivery-service.test.ts`)

- Validation des transitions de statut autorisées (`pending` → `in_progress`, `in_progress` → `delivered`, etc.)
- Rejet des transitions interdites (`delivered` → `pending`)
- Transition automatique de `orders.status` : `paid` → `processing` (premier item `in_progress`), `processing` → `delivered` (tous items `delivered`)
- Calcul de l'urgence (jours restants avant `startDate`)

#### Tests E2E (`e2e/deliveries.spec.ts`)

Scénarios UI (fixture `page`) :

1. **La page `/admin/deliveries` affiche les items en attente** — après création d'une commande (via setup DB), naviguer vers la page, vérifier que les items apparaissent avec les bonnes infos (film, cinéma, ayant droit, statut `pending`)
2. **Prendre en charge une livraison** — cliquer "Prendre en charge", remplir la note, confirmer → statut passe à `in_progress`, badge se met à jour
3. **Marquer une livraison comme livrée** — cliquer "Marquer livré", ajouter une note et un n° labo, confirmer → statut passe à `delivered`, `deliveredAt` renseigné
4. **Éditer les notes sur un item livré** — ouvrir le dialog notes sur un item `delivered`, modifier, sauvegarder → notes mises à jour
5. **Filtrage par onglets** — vérifier que les onglets "À traiter" / "En cours" / "Livrées" filtrent correctement
6. **Recherche** — chercher par titre de film, vérifier les résultats
7. **Badge d'urgence** — avec un item dont `startDate` est proche, vérifier que le badge urgence s'affiche correctement
8. **Transition `orders.status`** — après livraison de tous les items d'une commande, vérifier que le statut de la commande passe à `delivered` côté exploitant (`/orders`)

#### Test du setting `deliveryUrgencyDaysBeforeStart` (`e2e/admin.spec.ts`)

- Modifier le seuil dans `/admin/settings`, vérifier la sauvegarde et le toast de confirmation

**Helpers nécessaires** :
- Fonction de création de commande de test (insertion directe DB via `postgres`) avec items à livrer
- Réutiliser `setupExhibitor` / `uniqueEmail` de `e2e/helpers/`
