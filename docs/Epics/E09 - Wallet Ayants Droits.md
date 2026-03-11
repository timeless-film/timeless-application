# E09 — Wallet Ayants Droits

**Phase** : P3
**Statut** : ⬜ A faire
**Outils** : Stripe Connect (Balance, Payouts, Transfers)

---

## Contexte

Après chaque paiement (E08), Stripe Connect transfère la part de l'ayant droit (`rightsHolderAmount`) vers son compte Connect Express via `stripe.transfers.create()` (avec `source_transaction` = Charge ID). Le `stripeTransferId` est stocké sur chaque `orderItem`.

L'ayant droit a besoin d'un dashboard financier pour :

1. **Voir ses soldes** — disponible (prêt à retirer) et en attente (période de rétention Stripe)
2. **Suivre ses transactions** — chaque film vendu, avec montant brut, commission, net
3. **Retirer ses fonds** — manuellement ou en automatique vers son compte bancaire (configuré lors de l'onboarding KYC E03-002)
4. **Consulter l'historique des virements** — avec statut temps réel et export

> **Pas de table wallet locale** : les soldes et transactions sont lus directement depuis l'API Stripe Connect (`stripe.balance.retrieve()`, `stripe.transfers.list()`, `stripe.payouts.list()`). TIMELESS ne stocke pas de solde local — Stripe est la source de vérité. On enrichit les données Stripe avec les informations TIMELESS (nom du film, nom du cinéma) via jointure avec `orderItems`.

---

## Modèle de données

### Tables existantes utilisées

| Table | Champ | Usage E09 |
|-------|-------|-----------|
| `accounts` | `stripeConnectAccountId` | ID du compte Stripe Connect Express de l'ayant droit |
| `accounts` | `stripeConnectOnboardingComplete` | Pré-requis : doit être `true` pour accéder au wallet |
| `orderItems` | `stripeTransferId` | Rattache un transfer Stripe à un item de commande |
| `orderItems` | `rightsHolderAmount` | Montant net reçu par l'ayant droit (centimes) |
| `orderItems` | `catalogPrice`, `commissionRate` | Pour afficher le détail : brut / commission / net |
| `orderItems` | `currency` | Devise de la transaction |
| `orderItems` | `filmId`, `cinemaId`, `rightsHolderAccountId` | Jointure pour enrichir les données Stripe |
| `orders` | `orderNumber`, `paidAt` | Date et numéro de commande associé |
| `films` | `title`, `originalTitle` | Nom du film dans le tableau des transactions |
| `cinemas` | `name` | Nom du cinéma dans le tableau des transactions |

### Aucune nouvelle table

Les soldes viennent de Stripe (`stripe.balance.retrieve({ stripeAccount })`), pas d'une table locale. Les transactions sont la jointure entre `stripe.transfers.list()` et `orderItems.stripeTransferId`. Les virements viennent de `stripe.payouts.list({ stripeAccount })`.

> **Décision architecture** : pas de table `walletTransactions` locale. Stripe est la source de vérité pour les fonds. En cas de besoin de cache ou d'analytics avancées, un cron de synchronisation pourra être ajouté plus tard (hors scope E09).

---

## Dépendances

### Pré-requis (déjà réalisés)

| Épic | Composant | Détail |
|------|-----------|--------|
| E03-002 | Onboarding Stripe Connect | `stripeConnectAccountId` + onboarding Express + webhook `account.updated` |
| E08-001 | Transfers après paiement | `transferToRightsHolder()` → `stripeTransferId` sur `orderItems` |
| E08-001 | Webhook signature | Vérification des webhooks Stripe déjà en place |
| E08-003 | Order service | `order-service.ts` avec requêtes sur `orders` / `orderItems` |

### Débloqué par E09

| Épic | Composant |
|------|-----------|
| E11 | Dashboard admin : vue globale des payouts en cours |

---

## Décisions Produit

1. **Wallet = vue métier synthétique** — le wallet TIMELESS est une vue de synthèse enrichie (achats rattachés aux films/cinémas, graphiques, KPIs). Il **complète** le dashboard Stripe Express (gestion bancaire, documents fiscaux). Une bannière permanente dans le wallet propose un lien vers le dashboard Stripe Express pour la gestion avancée (comptes bancaires, relevés Stripe, documents fiscaux).
2. **Pas de wallet local** — les soldes sont lus directement via l'API Stripe Connect. Pas de risque de désynchronisation.
3. **Devise du wallet = devise du compte Stripe Connect** — définie lors de l'onboarding KYC. Stripe gère la conversion si le transfer est dans une devise différente. En pratique, un ayant droit importe ses films dans une seule devise. Si des fonds existent dans plusieurs devises, un résumé multi-devise est affiché dans les KPI cards.
4. **Transactions enrichies** — on enrichit les `transfers` Stripe avec les métadonnées TIMELESS (film, cinéma, commande) via `orderItems.stripeTransferId`. Cette même donnée est réutilisable dans la fiche film pour voir les ventes par film.
5. **Payout schedule → page Stripe Connect** — la configuration des virements automatiques se fait dans la page `/account/stripe-connect` (pas dans le wallet). Le wallet est une vue métier, la config payout est une config technique du compte.
6. **Retrait manuel = payout instantané** — `stripe.payouts.create()` sur le compte Connect. L'ayant droit choisit le montant (max = solde disponible).
7. **Onboarding requis** — si `stripeConnectOnboardingComplete === false`, la page wallet affiche un message avec un CTA vers l'onboarding (comme le banner existant).
8. **Commission visible** — l'ayant droit voit le montant brut (`catalogPrice`), la commission TIMELESS (`commissionRate`), et le net (`rightsHolderAmount`). Transparence totale sur sa part.
9. **Export CSV formaté** — montants en format lisible (`150.00`, pas `15000`). Pas de PDF en P0. Le CSV couvre les besoins comptables de base.
10. **Ventes par film** — la page détail d'un film côté ayant droit affiche aussi les transactions liées (même service `getWalletTransactions()` filtré par `filmId`). Permet d'identifier les films les plus vendus.

---

## Hors scope

- **Remboursements** → E11 (backoffice admin, `stripe.refunds.create()` + reversal de transfer)
- **Dashboard admin des payouts** → E11
- **Facturation TIMELESS → ayant droit** → pas nécessaire (Stripe fournit les relevés via le dashboard Express)
- **Notifications push** → hors prototype
- **Gestion des comptes bancaires** → géré dans le dashboard Stripe Express (lien depuis le wallet)

---

## État de l'existant (pré-requis réalisés)

| Composant | Fichier | Statut | Détail |
|-----------|---------|--------|--------|
| Stripe SDK | `src/lib/stripe/index.ts` | ✅ Done | Instance `stripe` configurée, API `2026-02-25.clover` |
| Transfer après paiement | `src/lib/stripe/index.ts` | ✅ Done | `transferToRightsHolder()` → crée un transfer avec `source_transaction` (Charge ID) |
| Webhook Stripe | `src/app/api/webhooks/stripe/route.ts` | ✅ Done | `checkout.session.completed`, `checkout.session.expired`, `account.updated` |
| Page wallet (stub) | `src/app/[locale]/(rights-holder)/wallet/page.tsx` | ✅ Done | Stub vide — titre seulement |
| Sidebar RH — lien wallet | `src/app/[locale]/(rights-holder)/layout.tsx` | ✅ Done | Icône `wallet`, lien `/wallet` |
| Banner onboarding | `src/components/account/stripe-connect-banner.tsx` | ✅ Done | Affiché si `stripeConnectOnboardingComplete === false` |
| Analytics revenus | `src/lib/services/analytics-service.ts` | ✅ Done | `sum(orderItems.rightsHolderAmount)` agrégé par mois |
| Clés i18n wallet | `messages/en.json` / `messages/fr.json` | ✅ Done | Namespace `wallet.*` avec clés pour dashboard, retrait, payouts, transactions |
| Order service | `src/lib/services/order-service.ts` | ✅ Done | `getOrdersForExhibitor()`, `getOrderDetail()` |
| Stripe Connect actions | `src/components/account/stripe-connect-actions.ts` | ✅ Done | `createStripeConnectDashboardLink()` — lien vers le dashboard Express |

---

## Tickets

---

### E09-001 — Service wallet (couche Stripe Connect)
**Priorité** : P0 | **Taille** : M | **Statut** : ⬜ A faire

**Pré-requis** : E08 ✅

Créer `src/lib/services/wallet-service.ts` — une couche d'abstraction au-dessus de l'API Stripe Connect pour le wallet.

#### Fonctions à implémenter

1. **`getWalletBalance(stripeConnectAccountId: string)`**
   - Appeler `stripe.balance.retrieve({ stripeAccount: stripeConnectAccountId })`
   - Retourner un objet typé `{ available: AmountByCurrency[], pending: AmountByCurrency[] }` où `AmountByCurrency = { amount: number; currency: string }`
   - Stripe retourne les soldes par devise — le dashboard affichera chaque devise séparément

2. **`getWalletTransactions(stripeConnectAccountId: string, accountId: string, options?: { limit?, startingAfter?, filmId?, cinemaId? })`**
   - Appeler `stripe.transfers.list({ destination: stripeConnectAccountId, limit, starting_after })` depuis le compte **plateforme** (pas en `stripeAccount` context)
   - Pour chaque transfer : enrichir avec les données TIMELESS via `orderItems.stripeTransferId` → joindre `films.title`, `cinemas.name`, `orders.orderNumber`, `orders.paidAt`
   - **Enrichissement batch** : collecter tous les `metadata.order_item_id` des transfers retournés → une seule query `WHERE orderItems.id IN (...)` avec jointures `films`, `cinemas`, `orders` → construire un `Map<orderItemId, enrichment>` → itérer les transfers pour fusionner
   - Retourner `{ transactions: WalletTransaction[], hasMore: boolean, nextCursor?: string }` avec :
     ```typescript
     type WalletTransaction = {
       id: string;                  // Stripe transfer ID
       date: Date;                  // transfer.created (timestamp UNIX → Date)
       filmTitle: string;
       cinemaName: string;
       orderNumber: string;         // "ORD-000042" (via formatOrderNumber())
       grossAmount: number;         // catalogPrice (centimes)
       commissionAmount: number;    // catalogPrice - rightsHolderAmount
       netAmount: number;           // rightsHolderAmount (centimes)
       currency: string;            // orderItems.currency (devise de la charge)
     }
     ```
   - **Pas de statut par transaction en P0** : les `transfers` Stripe n'ont pas de champ `status`. Pour déduire si des fonds sont `pending` / `available` / `paid_out`, il faudrait fetch la `balance_transaction` de chaque `destination_payment` (N appels API supplémentaires) puis croiser avec les payouts. C'est trop coûteux et fragile. Les KPI cards (solde disponible / en attente) donnent déjà l'info agrégée. **Le statut par ligne pourra être ajouté post-MVP via un webhook `transfer.created` + cache local.**
   - **Pagination forward-only** : Stripe cursor-based avec `starting_after` (ID du dernier transfer). Stripe ne supporte pas `ending_before` de façon fiable pour les transfers. Le client cache les pages vues pour permettre de revenir en arrière.
   - Filtre optionnel par `filmId` / `cinemaId` côté DB (post-enrichissement, avant retour)

3. **`getPayoutHistory(stripeConnectAccountId: string, options?: { limit?, startingAfter? })`**
   - Appeler `stripe.payouts.list({ stripeAccount: stripeConnectAccountId, limit, starting_after })`
   - Retourner `{ payouts: WalletPayout[], hasMore: boolean, nextCursor?: string }` :
     ```typescript
     type WalletPayout = {
       id: string;                  // Stripe payout ID
       amount: number;              // centimes
       currency: string;
       status: "pending" | "in_transit" | "paid" | "failed" | "canceled";
       createdAt: Date;
       arrivalDate: Date;           // Date estimée d'arrivée
       bankLast4?: string;          // 4 derniers chiffres du compte
       failureMessage?: string;     // Si status === "failed"
     }
     ```

4. **`createManualPayout(stripeConnectAccountId: string, amount: number, currency: string)`**
   - Appeler `stripe.payouts.create({ amount, currency }, { stripeAccount: stripeConnectAccountId })`
   - Vérifier que `amount > 0` et `amount <= solde disponible` (re-fetch balance avant)
   - Retourner `{ payoutId: string, arrivalDate: Date }`

5. **`getPayoutSchedule(stripeConnectAccountId: string)`**
   - Appeler `stripe.accounts.retrieve(stripeConnectAccountId)` → lire `settings.payouts.schedule`
   - Retourner `{ interval: "manual" | "daily" | "weekly" | "monthly", weeklyAnchor?: string, monthlyAnchor?: number }`

6. **`updatePayoutSchedule(stripeConnectAccountId: string, schedule: PayoutScheduleInput)`**
   - Appeler `stripe.accounts.update(stripeConnectAccountId, { settings: { payouts: { schedule } } })`
   - Valider les paramètres avec Zod avant l'appel

7. **`getRevenueStats(accountId: string)`**
   - Requête DB sur `orderItems` (pas l'API Stripe) pour performance :
     - Revenus du mois en cours : `SUM(rightsHolderAmount)` WHERE `orders.paidAt` >= 1er du mois AND `rightsHolderAccountId = accountId`, **groupé par `currency`**
     - Revenus du mois précédent : même query pour M-1
   - **Attention `orderItems.currency`** = devise de l'exploitant (la devise de la charge Stripe). Si un même RH a des ventes en EUR et en GBP, les montants ne sont pas additifs. Il faut grouper par devise.
   - Retourner `{ currentMonth: AmountByCurrency[], previousMonth: AmountByCurrency[] }` (réutilise le type `AmountByCurrency`)
   - En pratique, un RH importe dans une seule devise → la plupart du temps 1 seule entrée par tableau

8. **`getRevenueChart(accountId: string, period: "30d" | "12m")`**
   - Requête DB sur `orderItems` agrégée par jour (30d) ou par mois (12m) :
     - `SUM(rightsHolderAmount)` groupé par `DATE_TRUNC('day'|'month', orders.paidAt)` **et par `currency`**
   - Jointure avec `orders` sur `orderItems.orderId = orders.id` (pour accéder à `orders.paidAt`) — la query existante dans `analytics-service.ts` utilise `orderItems.createdAt`, mais `orders.paidAt` est plus pertinent ici (date réelle du paiement, pas de la création du record)
   - Retourner `{ series: RevenueChartSeries[] }` avec :
     ```typescript
     type RevenueChartSeries = {
       currency: string;
       points: { date: string; amount: number }[];
     }
     ```
   - Le graphique affiche une série par devise (en pratique : 1 seule série la plupart du temps)
   - Si multi-devise : chaque série a sa propre couleur et légende

9. **`getTransactionsForFilm(accountId: string, filmId: string, options?: { limit?, startingAfter? })`**
   - Requête DB directe sur `orderItems` (pas l'API Stripe) filtrée par `filmId` + `rightsHolderAccountId`
   - Jointure avec `orders` (orderNumber, paidAt), `cinemas` (name)
   - Retourner `{ transactions: FilmTransaction[], hasMore: boolean }` :
     ```typescript
     type FilmTransaction = {
       date: Date;
       cinemaName: string;
       orderNumber: string;
       grossAmount: number;        // catalogPrice
       commissionAmount: number;   // catalogPrice - rightsHolderAmount
       netAmount: number;          // rightsHolderAmount
       currency: string;
     }
     ```
   - Utilisé dans la fiche film (E09-008) pour afficher les ventes de ce film

#### Checklist

- [ ] Créer `src/lib/services/wallet-service.ts`
- [ ] `getWalletBalance()` — Stripe `balance.retrieve`
- [ ] `getWalletTransactions()` — Stripe `transfers.list` + enrichissement DB
- [ ] `getPayoutHistory()` — Stripe `payouts.list`
- [ ] `createManualPayout()` — Stripe `payouts.create` avec vérification solde
- [ ] `getPayoutSchedule()` / `updatePayoutSchedule()` — Stripe `accounts.retrieve/update`
- [ ] `getRevenueStats()` — query DB `orderItems`
- [ ] `getRevenueChart()` — query DB agrégée par jour/mois
- [ ] `getTransactionsForFilm()` — query DB filtrée par film
- [ ] Types TypeScript : `WalletTransaction`, `WalletPayout`, `FilmTransaction`, `AmountByCurrency`, `RevenueChartSeries`, `PayoutScheduleInput`
- [ ] Tests unitaires : `getRevenueStats()`, `getRevenueChart()` (fonctions pures testables sans Stripe)
- [ ] Fonction utilitaire `formatAmountForDisplay(cents: number): string` — centimes → `"150.00"` (réutilisée dans CSV + export)

---

### E09-002 — Dashboard financier (page wallet)
**Priorité** : P0 | **Taille** : L | **Statut** : ⬜ A faire

**Pré-requis** : E09-001

Remplacer le stub de la page `/wallet` par un dashboard financier complet.

#### Layout de la page

La page est un **Server Component** qui charge les données initiales, avec des **Client Components** pour les interactions (retrait, pagination, filtres).

```
┌─────────────────────────────────────────────────────┐
│  Wallet                                             │
├─────────────────────────────────────────────────────┤
│  ℹ️ Pour gérer vos coordonnées bancaires, relevés   │
│  et documents fiscaux : [Accéder au dashboard ▸]    │
├──────────┬──────────┬──────────┬────────────────────┤
│ Solde    │ Solde en │ Revenus  │ Revenus du         │
│ dispo.   │ attente  │ ce mois  │ mois précédent     │
│ 1 250 €  │ 350 €   │ 890 €    │ 1 100 €            │
├──────────┴──────────┴──────────┴────────────────────┤
│  [Retirer les fonds]                                │
├─────────────────────────────────────────────────────┤
│  Évolution des revenus            [30j | 12m]       │
│  ┌─────────────────────────────────────────────┐    │
│  │  ▁▂▃▅▇█▆▅▃▂▁▃▅▇█▆▅▃▅▇█▆▅▃▂▁▃▅▇          │    │
│  └─────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────┤
│  Transactions                       [📥 CSV ▾]     │
│  ┌───────┬──────────┬─────────┬─────┬──────┬──────┐ │
│  │ Date  │ Film     │ Cinéma  │ N°  │Comm. │ Net  │ │
│  ├───────┼──────────┼─────────┼─────┼──────┼──────┤ │
│  │ 10/03 │ Vertigo  │ Le Rex  │ 42  │ 0€   │ 150€ │ │
│  │ 08/03 │ 2001     │ Lumière │ 41  │ 0€   │ 200€ │ │
│  └───────┴──────────┴─────────┴─────┴──────┴──────┘ │
│  ← Précédent (cache)           Suivant (cursor) →  │
├─────────────────────────────────────────────────────┤
│  Historique des virements                           │
│  ┌───────┬──────────┬─────────┬─────────────────┐   │
│  │ Date  │ Montant  │ Statut  │ Date d'arrivée  │   │
│  └───────┴──────────┴─────────┴─────────────────┘   │
│  ← Précédent (cache)           Suivant (cursor) →  │
└─────────────────────────────────────────────────────┘
```

#### KPI Cards (haut de page)

4 cartes en grille responsive (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`) — composants shadcn : `Card` + `CardHeader` + `CardTitle` + `CardContent` :

1. **Solde disponible** — `getWalletBalance().available` — icône `Wallet` (lucide) — texte vert si > 0
2. **Solde en attente** — `getWalletBalance().pending` — icône `Clock` — texte `muted-foreground`
3. **Revenus ce mois** — `getRevenueStats().currentMonth` — icône `TrendingUp`
4. **Revenus mois précédent** — `getRevenueStats().previousMonth` — icône `Calendar`

Tous les montants formatés avec `formatAmount()` (devise du compte Connect).

> **Multi-devise** : en pratique, un RH importe ses films dans une seule devise. Mais si des fonds existent dans plusieurs devises (ex. EUR + USD), afficher chaque devise sur sa propre ligne dans les cartes Solde disponible / En attente : `€1,250.00` sur une ligne, `$200.00` sur la suivante. Les cartes "Revenus" font de même (une ligne par devise).

#### Bannière dashboard Stripe Express

- Composant shadcn : `Alert` + `AlertDescription` avec style `border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200`
- Icône `Info` (lucide) à gauche
- Texte : `wallet.stripeBanner.text` ("Pour gérer vos coordonnées bancaires, relevés et documents fiscaux, accédez à votre dashboard Stripe.")
- Bouton : `wallet.stripeBanner.button` ("Accéder au dashboard") → `Button variant="outline" size="sm"` → `createStripeConnectDashboardLink()` → ouvre `target="_blank"`
- Toujours visible (pas dismissable) — c'est un point d'entrée permanent vers le dashboard Stripe Express

#### Graphique d'évolution des revenus

- **Client component** : `WalletRevenueChart` (`"use client"`)
- Graphique en barres verticales — librairie **recharts** (déjà SSR-friendly, React natif, ~45KB gzipped)
- Composants recharts : `BarChart` + `Bar` + `XAxis` + `YAxis` + `Tooltip` + `ResponsiveContainer`
- Toggle période avec shadcn `Tabs` + `TabsList` + `TabsTrigger` : **30 derniers jours** (barres par jour) / **12 derniers mois** (barres par mois)
- Données depuis `getRevenueChart()` (query DB, pas API Stripe) — chargement initial SSR, toggle via server action `fetchRevenueChart(period)`
- Si multi-devise : afficher une série par devise avec couleurs distinctes + légende
- Montants formatés dans le tooltip (`formatAmount()`)
- Responsive : `<ResponsiveContainer width="100%" height={300}>`
- **Empty state** : si aucune donnée pour la période → texte centré "Aucun revenu sur cette période" avec icône `BarChart3` grisée

#### Bouton "Retirer les fonds"

- `Button variant="default"` avec icône `ArrowUpRight` (lucide)
- Texte : `wallet.withdraw` ("Retirer les fonds")
- Visible uniquement si `available[0].amount > 0` (au moins une devise avec solde > 0)
- Ouvre le modal de retrait (E09-003)
- Si multi-devise disponible : le modal permettra de choisir la devise
- Désactivé si aucun `external_account` (compte bancaire) configuré sur Stripe — le vérifier via `stripe.accounts.retrieve()` → `external_accounts.data.length > 0`. Si pas de compte bancaire : afficher un `Tooltip` expliquant qu'il faut configurer un compte bancaire via le dashboard Stripe Express

#### Tableau des transactions

- **Client component** : `WalletTransactionsTable` (`"use client"`)
- Composants shadcn : `Table` + `TableHeader` + `TableHead` + `TableBody` + `TableRow` + `TableCell`
- Colonnes : Date | Film | Cinéma | N° commande | Brut | Commission | Net
- **Pas de colonne statut en P0** (cf. décision E09-001 — les transfers Stripe n'ont pas de statut exploitable sans N+1 API calls)
- **Pagination forward-only** (Stripe cursor-based `starting_after`) :
  - Bouton "Suivant" → appelle server action `fetchWalletTransactions(cursor)` → `cursor` = ID du dernier transfer de la page courante
  - Bouton "Précédent" → **client-side cache** (stocker les pages vues dans un `useRef<WalletTransaction[][]>([])` + index de page courant)
  - **Pas d'offset-based** : Stripe ne supporte pas `page=2` sur les transfers
- Données initiales chargées côté serveur (SSR) via `getWalletTransactions()`
- Taille de page : 10 transactions
- `Skeleton` rows (5 lignes, largeur variée) pendant le chargement via `isPending` de `useTransition()`
- Montants formatés avec `formatAmount()` en devise de la transaction
- **Empty state** : "Aucune transaction" avec icône `Receipt` grisée — guard SSR : `initialTotal === 0 && transactions.length === 0 && !isPending`
- **Responsive** : sur mobile (`< md`), masquer les colonnes Brut et Commission (garder seulement Date, Film, Net). Utiliser `className="hidden md:table-cell"` sur les `<TableHead>` et `<TableCell>` correspondants

#### Tableau des payouts (historique des virements)

- **Client component** : `WalletPayoutsTable` (`"use client"`)
- Composants shadcn : `Table` + `Badge` pour les statuts
- Colonnes : Date | Montant | Statut | Date d'arrivée estimée
- Même pattern de pagination forward-only (cache client-side des pages vues)
- Statuts avec `Badge` :
  - `pending` → `<Badge variant="outline" className="border-yellow-300 bg-yellow-50 text-yellow-700">` + texte `wallet.payouts.status.initiated`
  - `in_transit` → `<Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700">` + texte `wallet.payouts.status.in_transit`
  - `paid` → `<Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">` + texte `wallet.payouts.status.paid`
  - `failed` → `<Badge variant="destructive">` + texte `wallet.payouts.status.failed`
  - `canceled` → `<Badge variant="secondary">` + texte "Annulé"
- Si `failed` : afficher `failureMessage` dans un `Tooltip` (shadcn `Tooltip` + `TooltipTrigger` + `TooltipContent`) sur le badge
- **Empty state** : "Aucun virement" — visible si pas de payouts et pas de loading

#### Fichiers à créer / modifier

| Action | Fichier |
|--------|---------|
| Créer | `src/app/[locale]/(rights-holder)/wallet/page.tsx` (Server Component — remplacer le stub) |
| Créer | `src/components/wallet/wallet-dashboard.tsx` (Client Component orchestrateur) |
| Créer | `src/components/wallet/wallet-kpi-cards.tsx` |
| Créer | `src/components/wallet/wallet-revenue-chart.tsx` (recharts `BarChart`) |
| Créer | `src/components/wallet/wallet-transactions-table.tsx` |
| Créer | `src/components/wallet/wallet-payouts-table.tsx` |
| Créer | `src/components/wallet/wallet-actions.ts` (server actions) |

#### Checklist

- [ ] Page wallet : requête SSR initiale (balance, stats, chart 30d, transactions page 1, payouts page 1)
- [ ] Guard onboarding : si `stripeConnectOnboardingComplete === false`, afficher CTA onboarding au lieu du dashboard
- [ ] Bannière Stripe Express : composant `Alert` avec CTA permanent vers le dashboard Express (nouvel onglet)
- [ ] KPI Cards : 4 `Card` responsive avec montants formatés, icônes lucide, support multi-devise
- [ ] Graphique revenus : recharts `BarChart`, toggle `Tabs` 30j/12m, responsive `ResponsiveContainer`, empty state
- [ ] Server action `fetchRevenueChart(period)` pour le toggle de période
- [ ] Tableau transactions : `Table` avec 7 colonnes (pas de statut), pagination forward-only, cache client-side des pages, skeletons
- [ ] Colonnes responsive : masquer Brut/Commission sur mobile (`hidden md:table-cell`)
- [ ] Tableau payouts : `Table` + `Badge` colorés par statut, `Tooltip` sur `failed`, même pagination
- [ ] Server actions : `fetchWalletTransactions(cursor)`, `fetchWalletPayouts(cursor)`
- [ ] Bouton "Retirer les fonds" conditionnel (solde > 0 + `external_accounts.data.length > 0`)
- [ ] Empty states : transactions vides, payouts vides, graphique vide
- [ ] Responsive : mobile (1 col), tablette (2 col), desktop (4 col pour KPI)
- [ ] Accessibilité : `aria-label` sur badges, `<table>` sémantique, `scope="col"` sur `<TableHead>`

---

### E09-003 — Retrait manuel
**Priorité** : P0 | **Taille** : M | **Statut** : ⬜ A faire

**Pré-requis** : E09-001, E09-002

Permettre à l'ayant droit de déclencher un retrait (payout) depuis le dashboard wallet.

#### UX

1. **Bouton "Retirer les fonds"** dans la section KPI du wallet : `Button variant="default"` — `disabled` si solde disponible = 0 ou onboarding incomplet.
2. **Modal de retrait** : `Dialog` (shadcn `Dialog` + `DialogContent` + `DialogHeader` + `DialogTitle` + `DialogDescription` + `DialogFooter`)
3. Contenu du modal :
   - **Devise** (si multi-devise) : `Select` avec les devises ayant un solde > 0 (ex. `EUR`, `USD`). Pré-sélectionné sur la devise du premier solde. Si une seule devise : pas de sélecteur, juste l'info affichée.
   - **Montant** : `Input type="number"` + `step="0.01"` + `min="1"`, pré-rempli avec le solde disponible dans la devise sélectionnée. L'ayant droit peut modifier (min 1.00 EUR/USD/GBP, max = solde disponible). Converti en centimes avant envoi.
   - **Solde disponible** : texte informatif sous le champ → `wallet.withdrawModal.available` ("Disponible : {amount}")
   - **Délai estimé** : texte `text-xs text-muted-foreground` → `wallet.withdrawModal.delay` ("Les fonds seront virés sous 1 à 2 jours ouvrés.")
   - **Bouton** : `Button` "Confirmer le retrait" → `disabled` pendant l'appel + icône `Loader2 animate-spin`
4. **Confirmation** : `toast.success()` avec montant et date d'arrivée estimée → fermer le modal → revalidate les données du wallet
5. **Erreur** : `toast.error()` avec message traduit (code → `wallet.errors.*`)

#### Backend — Server action

Créer `withdrawFunds()` dans `src/components/wallet/wallet-actions.ts` :

```typescript
"use server";
export async function withdrawFunds(amount: number, currency: string) {
  // 1. Auth — vérifier session + account type === "rights_holder"
  // 2. Validation — Zod (withdrawSchema)
  // 3. Vérifier stripeConnectOnboardingComplete === true
  // 4. Vérifier que le solde disponible >= amount dans la devise demandée (re-fetch balance via getWalletBalance)
  // 5. Appeler walletService.createManualPayout(stripeConnectAccountId, amount, currency)
  // 6. Envoyer email de confirmation
  // 7. Return { success: true, arrivalDate: string }
  //
  // Mapping erreurs Stripe → nos codes :
  //   - StripeInvalidRequestError "insufficient funds"    → INSUFFICIENT_BALANCE
  //   - StripeInvalidRequestError "no external account"   → NO_BANK_ACCOUNT
  //   - StripeInvalidRequestError "account_closed"        → BANK_ACCOUNT_CLOSED
  //   - Toute autre StripeError                           → PAYOUT_FAILED
}
```

#### Mapping des erreurs Stripe

| Stripe error | Notre code | Clé i18n |
|--------------|-----------|----------|
| Balance insuffisant (vérifié avant appel) | `INSUFFICIENT_BALANCE` | `wallet.errors.insufficientBalance` |
| `no external account` (pas de compte bancaire) | `NO_BANK_ACCOUNT` | `wallet.errors.noBankAccount` |
| `account_closed` (compte bancaire fermé) | `BANK_ACCOUNT_CLOSED` | `wallet.errors.bankAccountClosed` |
| Catch-all `Stripe.errors.StripeError` | `PAYOUT_FAILED` | `wallet.errors.payoutFailed` |
| Onboarding pas complété | `ONBOARDING_INCOMPLETE` | `wallet.errors.onboardingIncomplete` |

#### Email de confirmation du retrait

Créer `sendWithdrawalConfirmationEmail()` dans `src/lib/email/wallet-emails.ts` (nouveau fichier — pattern identique à `order-emails.ts`) :

```typescript
export async function sendWithdrawalConfirmationEmail(params: {
  to: string;
  name: string;
  amount: number;          // centimes
  currency: string;
  arrivalDate: string;     // ISO date string
  walletUrl: string;       // lien absolu vers /wallet
}): Promise<void>
```

- **Sujet (en)** : `"Withdrawal confirmed — {formattedAmount}"` (ex: "Withdrawal confirmed — €150.00")
- **Sujet (fr)** : `"Retrait confirmé — {formattedAmount}"`
- **Contenu** : HTML inline (même pattern que `order-emails.ts`) — nom, montant formaté, date d'arrivée estimée, lien vers le wallet
- Appeler via `safeEmail("withdrawalConfirmation", { to, subject, html })`

#### Checklist

- [ ] Modal `Dialog` avec champ montant pré-rempli + sélecteur devise si multi-devise
- [ ] Validation Zod du montant (int, positif, <= solde disponible)
- [ ] Server action `withdrawFunds()` avec auth + vérification complète
- [ ] Mapping erreurs Stripe → codes internes (5 codes documentés ci-dessus)
- [ ] Appel `walletService.createManualPayout()`
- [ ] Vérification du solde disponible avant le payout (re-fetch `getWalletBalance()`)
- [ ] Toast succès avec montant + date d'arrivée → fermer modal → revalidate
- [ ] Toast erreur avec codes traduits (`wallet.errors.*`)
- [ ] Créer `src/lib/email/wallet-emails.ts` — `sendWithdrawalConfirmationEmail()`
- [ ] Refresh des KPI cards et du tableau payouts après retrait réussi (`revalidatePath` ou `router.refresh()`)
- [ ] Clés i18n : `wallet.withdrawModal.*` ✅ existantes, ajouter `wallet.errors.*`, `wallet.withdrawModal.success`, `wallet.withdrawModal.currencySelect`

---

### E09-004 — Configuration des virements automatiques (page Stripe Connect)
**Priorité** : P1 | **Taille** : M | **Statut** : ⬜ A faire

**Pré-requis** : E09-001

Configuration du payout schedule Stripe natif. **Conformément à la décision produit #5**, cette feature vit dans la page `/account/stripe-connect` (pas dans le wallet). Le wallet est une vue métier ; la configuration des payouts est un paramètre technique du compte Stripe.

#### UX — Nouvelle section dans la page Stripe Connect (`/account/stripe-connect`)

Ajouter une section **sous** le statut d'onboarding actuel dans `StripeConnectTab` (visible uniquement si `status === "complete"`) :

```
┌─────────────────────────────────────────────────────┐
│  Stripe Connect                                     │
│  ✅ Compte vérifié — [Dashboard Stripe] [Détacher]  │
├─────────────────────────────────────────────────────┤
│  Virements automatiques                             │
│  ┌──────────────────────────────────────────┐       │
│  │ Activer les virements automatiques [🔘]  │       │
│  │                                          │       │
│  │ Fréquence : [Quotidien ▾]               │       │
│  │                                          │       │
│  │ (si weekly) Jour : [Lundi ▾]            │       │
│  │ (si monthly) Jour du mois : [1 ▾]       │       │
│  │                                     [💾] │       │
│  └──────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────┘
```

**Composants shadcn/ui** : `Card` + `CardHeader` + `CardContent`, `Switch` pour le toggle, `Select` + `SelectContent` + `SelectItem` pour fréquence/jour, `Button` pour sauvegarder.

1. **Toggle** : `Switch` — "Activer les virements automatiques"
   - OFF → payout schedule = `manual` (défaut Stripe Connect Express)
   - ON → révèle les options de fréquence
2. **Fréquence** : `Select` avec options `daily` / `weekly` / `monthly`
   - `weekly` : sélecteur du jour de la semaine (`monday` … `friday`)
   - `monthly` : sélecteur du jour du mois (1–28, Stripe limite à 28)
3. **Seuil minimum** : Stripe Connect ne supporte pas nativement un seuil minimum de payout sur les comptes Express. **Hors scope P0** — on expose uniquement le schedule.
4. **Bouton sauvegarder** : visible uniquement si le schedule a changé. Désactivé pendant l'appel.

> **Note technique** : les comptes Stripe Connect Express ont par défaut un payout schedule géré par Stripe (généralement `daily` après la période de rétention 2–7 jours selon le pays). La modification du schedule via `stripe.accounts.update()` nécessite `details_submitted: true`.

#### Backend — Server action

Ajouter `updatePayoutSettings()` dans `src/components/account/stripe-connect-actions.ts` (pas wallet-actions — cohérent avec le placement dans la page Stripe Connect) :

```typescript
"use server";
export async function updatePayoutSettings(input: {
  interval: "manual" | "daily" | "weekly" | "monthly";
  weeklyAnchor?: string;    // "monday" | ... | "friday"
  monthlyAnchor?: number;   // 1–28
}) {
  // 1. Auth — vérifier session + account type === "rights_holder" + role owner/admin
  // 2. Validation Zod (payoutScheduleSchema)
  // 3. Vérifier stripeConnectOnboardingComplete === true
  // 4. Appeler walletService.updatePayoutSchedule()
  // 5. Return { success: true }
  // Erreurs possibles :
  //   - ONBOARDING_INCOMPLETE : compte Stripe pas encore vérifié
  //   - STRIPE_ERROR : erreur Stripe générique (catch StripeError)
}
```

#### Validation Zod

```typescript
const payoutScheduleSchema = z.discriminatedUnion("interval", [
  z.object({ interval: z.literal("manual") }),
  z.object({ interval: z.literal("daily") }),
  z.object({
    interval: z.literal("weekly"),
    weeklyAnchor: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday"]),
  }),
  z.object({
    interval: z.literal("monthly"),
    monthlyAnchor: z.number().int().min(1).max(28),
  }),
]);
```

#### Fichiers à créer / modifier

| Action | Fichier |
|--------|---------|
| Créer | `src/components/account/stripe-connect-payout-settings.tsx` — formulaire settings (`"use client"`) |
| Modifier | `src/components/account/stripe-connect-tab.tsx` — ajouter la section payout quand `status === "complete"` |
| Modifier | `src/components/account/stripe-connect-actions.ts` — ajouter `updatePayoutSettings()` |

#### Checklist

- [ ] Section paramètres payout dans la page Stripe Connect (sous le statut d'onboarding, visible si `complete`)
- [ ] Toggle `Switch` activé/désactivé (manual vs scheduled)
- [ ] `Select` de fréquence conditionnel (daily/weekly/monthly)
- [ ] `Select` jour de la semaine (si weekly)
- [ ] `Select` jour du mois (si monthly, 1–28)
- [ ] Bouton sauvegarder visible uniquement si changement détecté
- [ ] Server action `updatePayoutSettings()` dans `stripe-connect-actions.ts`
- [ ] Validation Zod discriminée
- [ ] Appel `walletService.updatePayoutSchedule()`
- [ ] Charger le schedule actuel au mount (SSR via `getPayoutSchedule()`)
- [ ] Toast succès / erreur
- [ ] Clés i18n : `stripeConnect.payoutSchedule.*` (nouveau namespace, pas `wallet.*`)

---

### E09-005 — Webhooks payout (suivi temps réel)
**Priorité** : P1 | **Taille** : S | **Statut** : ⬜ A faire

**Pré-requis** : E08 ✅ (webhook infra)

Ajouter des handlers webhook pour suivre le statut des payouts en temps réel.

#### Événements Stripe à gérer

| Événement | Action |
|-----------|--------|
| `payout.paid` | Logger succès. Email de confirmation à l'ayant droit : "Votre virement de {amount} {currency} a été versé sur votre compte bancaire." |
| `payout.failed` | Logger erreur avec `failure_message`. Email d'alerte à l'ayant droit : "Votre virement de {amount} {currency} a échoué : {reason}. Vérifiez vos coordonnées bancaires." + Email à ops. |

> **Architecture webhooks Connect** : les événements `payout.*` sont des événements Connect — ils proviennent du compte Connect de l'ayant droit, pas du compte plateforme. Stripe ajoute un header `Stripe-Account` (= `stripeConnectAccountId`). Le handler existant doit être étendu :
>
> - **Dev (`stripe listen`)** : `stripe listen --forward-to localhost:3099/api/webhooks/stripe` intercepte les événements plateforme ET Connect sur le même endpoint avec le même secret.
> - **Production** : deux options :
>   - **Option recommandée** : même endpoint `/api/webhooks/stripe` mais avec un **second webhook endpoint** dans le dashboard Stripe pour les événements Connect, utilisant un secret `STRIPE_CONNECT_WEBHOOK_SECRET`. Le handler vérifie la signature avec le bon secret selon la présence de `event.account`.
>   - **Alternative** : endpoint séparé `/api/webhooks/stripe/connect` avec son propre secret.
> - Pour P0 (dev/test) : on utilise le même endpoint et le même secret. La vérification de signature fonctionne car `stripe listen` forward tous les events au même secret.

#### Backend

Modifier `src/app/api/webhooks/stripe/route.ts` :

```typescript
// Après le switch existant (checkout.session.completed, checkout.session.expired, account.updated)
// Ajouter :

case "payout.paid": {
  const payout = event.data.object as Stripe.Payout;
  const connectAccountId = event.account; // string | undefined — présent pour les events Connect
  if (!connectAccountId) {
    console.error("[Webhook] payout.paid without account header — ignoring");
    break;
  }

  console.info(`[Webhook] payout.paid: ${payout.id} — ${payout.amount} ${payout.currency} → ${connectAccountId}`);

  // 1. Retrouver l'ayant droit via stripeConnectAccountId
  const rhAccount = await db.query.accounts.findFirst({
    where: eq(accounts.stripeConnectAccountId, connectAccountId),
  });
  if (!rhAccount) {
    console.error(`[Webhook] payout.paid: no account found for ${connectAccountId}`);
    break;
  }

  // 2. Retrouver l'email du owner du compte
  // (via members table → user table, where role = "owner")

  // 3. Envoyer email de confirmation
  await sendPayoutPaidEmail({ ... });
  break;
}

case "payout.failed": {
  const payout = event.data.object as Stripe.Payout;
  const connectAccountId = event.account;
  if (!connectAccountId) break;

  console.error(`[Webhook] payout.failed: ${payout.id} — ${payout.failure_code}: ${payout.failure_message}`);

  // 1. Retrouver l'ayant droit
  // 2. Email alerte à l'ayant droit (sendPayoutFailedEmail)
  // 3. Email alerte à ops (sendOpsPayoutFailedEmail)
  break;
}
```

#### Emails de notification payout

Ajouter dans `src/lib/email/wallet-emails.ts` :

1. **`sendPayoutPaidEmail(params: { to, name, amount, currency, arrivalDate })`**
   - Sujet (en) : `"Payout received — {formattedAmount}"`
   - Sujet (fr) : `"Virement reçu — {formattedAmount}"`
   - Contenu : montant, confirmation que les fonds ont été versés, lien wallet

2. **`sendPayoutFailedEmail(params: { to, name, amount, currency, failureMessage })`**
   - Sujet (en) : `"Payout failed — {formattedAmount}"`
   - Sujet (fr) : `"Échec du virement — {formattedAmount}"`
   - Contenu : montant, raison de l'échec, CTA vers dashboard Stripe Express pour vérifier les coordonnées bancaires

3. **`sendOpsPayoutFailedEmail(params: { opsEmail, connectAccountId, amount, currency, failureCode, failureMessage })`**
   - Sujet : `"[Ops] Payout failed for ${connectAccountId}"`
   - Contenu : toutes les infos techniques (IDs, codes, montants)

#### Checklist

- [ ] Handler `payout.paid` dans le webhook route — switch case avec `event.account` extraction
- [ ] Handler `payout.failed` dans le webhook route — logging `failure_code` + `failure_message`
- [ ] Retrouver l'ayant droit via `db.query.accounts.findFirst({ where: eq(stripeConnectAccountId, connectAccountId) })`
- [ ] Retrouver l'email du owner via la table `members` + `users`
- [ ] Créer `sendPayoutPaidEmail()` dans `src/lib/email/wallet-emails.ts`
- [ ] Créer `sendPayoutFailedEmail()` dans `src/lib/email/wallet-emails.ts`
- [ ] Créer `sendOpsPayoutFailedEmail()` — email technique aux ops
- [ ] Guard `event.account` : ignorer si absent (event plateforme, pas Connect)
- [ ] Logging structuré avec contexte (payout ID, montant, account, failure_code si applicable)
- [ ] Clés i18n pour emails : `email.payoutPaid.subject`, `email.payoutFailed.subject` (en + fr)
- [ ] Note dans CLAUDE.md/copilot-instructions : nouveau `STRIPE_CONNECT_WEBHOOK_SECRET` env var nécessaire en production

---

### E09-006 — Export CSV des transactions
**Priorité** : P1 | **Taille** : S | **Statut** : ⬜ A faire

**Pré-requis** : E09-001, E09-002

Permettre à l'ayant droit de télécharger un relevé de ses transactions au format CSV.

#### UX

- Bouton `Button variant="outline" size="sm"` avec icône `Download` (lucide) — texte : `wallet.csv.download` ("Télécharger le relevé")
- Placé à droite du titre "Transactions"
- Sélection de la période via `Popover` avec 3 presets : mois courant (défaut), mois précédent, plage personnalisée (2 `Calendar` date pickers via shadcn `Calendar` + `Popover`)
- Téléchargement immédiat après sélection (pas de preview)
- Loader (`Loader2 animate-spin`) sur le bouton pendant la génération

#### Backend — Server action (pas API route)

Créer `exportTransactionsCsv()` dans `src/components/wallet/wallet-actions.ts` (server action, pas API route — le wallet est interne, pas d'accès externe) :

```typescript
"use server";
export async function exportTransactionsCsv(startDate: string, endDate: string) {
  // 1. Auth — vérifier session + type rights_holder
  // 2. Validation Zod : dates ISO valides, endDate >= startDate, plage max 1 an
  // 3. Récupérer les transfers Stripe : stripe.transfers.list({ destination, created: { gte, lte }, limit: 100 })
  //    — boucler avec auto-pagination si > 100 transfers (stripe.transfers.list auto-paginates with for-await)
  // 4. Enrichir avec DB (même pattern batch que getWalletTransactions)
  // 5. Générer le CSV
  // 6. Return { csv: string, filename: string }
}
```

Le client reçoit le string CSV et déclenche le download via :
```typescript
const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
const url = URL.createObjectURL(blob);
// trigger download link programmatically
```

#### Format CSV

- **Encodage** : UTF-8 avec BOM (`\uFEFF` en début de fichier) — nécessaire pour qu'Excel détecte correctement l'UTF-8 et les accents dans les noms de films/cinémas
- **Séparateur** : virgule (`,`)
- **Échappement** : les champs contenant des virgules, guillemets, ou retours à la ligne sont entourés de guillemets doubles. Les guillemets dans les valeurs sont doublés (`""`)
- **Pas de dépendance externe** : string concatenation manuelle suffisante pour ce format simple. Fonction utilitaire `escapeCsvField(value: string): string`

```
Date,Order,Film,Cinema,Gross Amount,Commission,Net Amount,Currency
2026-03-10,ORD-000042,Vertigo,Le Rex,150.00,0.00,150.00,EUR
2026-03-08,ORD-000041,"2001, A Space Odyssey",Lumière,200.00,0.00,200.00,EUR
```

- **Montants** : formatés avec `formatAmountForDisplay()` — centimes → `"150.00"` (pas `15000`, pas `150`)
- **Dates** : format ISO `YYYY-MM-DD`
- **Nom de fichier** : `timeless-transactions-{YYYY-MM}-{YYYY-MM}.csv` (ex: `timeless-transactions-2026-03-2026-03.csv`)

#### Checklist

- [ ] Server action `exportTransactionsCsv(startDate, endDate)` dans `wallet-actions.ts`
- [ ] Sélecteur de période : 3 presets (`Popover` + `Calendar`) + plage personnalisée
- [ ] Validation Zod : dates ISO, endDate >= startDate, plage max 1 an
- [ ] Génération CSV : UTF-8 BOM, virgule séparateur, échappement guillemets doubles
- [ ] Fonction `escapeCsvField()` pour les champs avec virgules/guillemets
- [ ] Montants formatés via `formatAmountForDisplay()` (centimes → `"150.00"`)
- [ ] Download côté client via `Blob` + `URL.createObjectURL`
- [ ] Nom de fichier dynamique avec la plage de dates
- [ ] Auto-pagination Stripe si > 100 transfers sur la période
- [ ] Clés i18n : `wallet.csv.currentMonth`, `wallet.csv.previousMonth`, `wallet.csv.custom`, `wallet.csv.download`

---

### E09-007 — Ventes par film (fiche film RH)
**Priorité** : P1 | **Taille** : S | **Statut** : ⬜ A faire

**Pré-requis** : E09-001

Ajouter une section "Ventes" dans la page détail d'un film côté ayant droit (`/films/[filmId]`). Permet d'identifier les films les plus vendus et de voir qui achète quel film.

#### UX

- Nouvelle section sous les informations existantes du film
- Tableau : Date | Cinéma | N° commande | Brut | Commission | Net
- Pagination (10 par page)
- Compteur total de ventes et revenu cumulé en tête de section
- Si aucune vente : message "Aucune vente pour ce film"

#### Backend

- Utiliser `walletService.getTransactionsForFilm(accountId, filmId)` (E09-001)
- Données depuis la DB (pas l'API Stripe) — query sur `orderItems` filtré par `filmId`

#### Fichiers à créer / modifier

| Action | Fichier |
|--------|--------|
| Créer | `src/components/wallet/film-transactions-table.tsx` — tableau des ventes par film |
| Modifier | `src/app/[locale]/(rights-holder)/films/[filmId]/page.tsx` — ajouter la section |

#### Checklist

- [ ] Section "Ventes" dans la fiche film RH
- [ ] Tableau avec colonnes : Date, Cinéma, N° commande, Brut, Commission, Net
- [ ] Compteur total + revenu cumulé
- [ ] Pagination (10 par page)
- [ ] Empty state si aucune vente
- [ ] Clés i18n : `films.transactions.*`

---

### E09-008 — Tests
**Priorité** : P0 | **Taille** : M | **Statut** : ⬜ A faire

**Pré-requis** : E09-001 à E09-007

#### Tests unitaires (Vitest)

| Test | Fichier |
|------|---------|
| `getRevenueStats()` — calcul revenus mois courant/précédent, groupé par devise | `src/lib/services/__tests__/wallet-service.test.ts` |
| `getRevenueChart()` — agrégation par jour/mois, groupé par devise | `src/lib/services/__tests__/wallet-service.test.ts` |
| Validation Zod `withdrawSchema` (montant positif, currency 3 chars) | `src/lib/services/__tests__/wallet-service.test.ts` |
| Validation Zod `payoutScheduleSchema` (discriminatedUnion) | `src/lib/services/__tests__/wallet-service.test.ts` |
| `escapeCsvField()` — champs avec virgules, guillemets, retours à la ligne | `src/lib/services/__tests__/wallet-service.test.ts` |
| `formatAmountForDisplay()` — centimes → format `"150.00"` | `src/lib/services/__tests__/wallet-service.test.ts` |
| Génération CSV complète (BOM, headers, échappement, montants formatés) | `src/lib/services/__tests__/wallet-service.test.ts` |

#### Tests E2E — UI (Playwright)

Fichier : `e2e/wallet.spec.ts`

**Compte Stripe Connect de test** : `acct_1T9Xa2Fg5bm7UN8b` — compte Express existant en mode test. **Règle absolue : ne jamais supprimer ce compte.**

L'ayant droit E2E sera rattaché à ce compte Stripe via `accounts.stripeConnectAccountId`. Un helper `setupRightsHolderWithStripeAccount()` créera un utilisateur RH avec ce compte pré-configuré.

| # | Scénario | Type | avec lien, et les 4 KPI cards | `page` |
| 2 | RH sans onboarding Stripe → message CTA onboarding au lieu du dashboard | `page` |
| 3 | Tableau des transactions affiche les données enrichies (film, cinéma, n° commande, montants) | `page` |
| 4 | Pagination forward-only : bouton Suivant charge la page suivante, Précédent revient au cache | `page` |
| 5 | Modal de retrait s'ouvre avec le solde pré-rempli et la devise sélectionnée | `page` |
| 6 | Graphique des revenus s'affiche avec toggle Tabs 30j/12m | `page` |
| 7 | Tableau des payouts affiche l'historique avec Badge de statut coloré | `page` |
| 8 | Paramètres payout schedule sur la page `/account/stripe-connect` (toggle Switch + Select fréquence) | `page` |
| 9 | Section ventes sur la fiche film affiche les transactions du film avec compteur total | `page` |
| 10 | Export CSV télécharge un fichier avec BOM UTF-8, montants formatés `"150.00"`, champs échappgle + fréquence) | `page` |
| 9 | Section ventes sur la fiche film affiche les transactions du film | `page` |
| 10 | Export CSV télécharge un fichier avec des montants formatés | `page` |

#### Checklist

- [ ] Tests unitaires : `getRevenueStats()`, `getRevenueChart()`, schemas Zod, `escapeCsvField()`, `formatAmountForDisplay()`
- [ ] Helper E2E : `setupRightsHolderWithStripeAccount()` dans `e2e/helpers/rights-holder.ts` (utilise `acct_1T9Xa2Fg5bm7UN8b`)
- [ ] Tests E2E : tous les scénarios listés ci-dessus
- [ ] Pas de `test.skip`, pas de `waitForTimeout()`

---

## API

> **Pas d'API REST v1 dédiée au wallet en P0**. Le wallet est une vue interne pour les ayants droits, consommée uniquement via des server actions (y compris l'export CSV). Une API REST pourra être ajoutée dans un epic futur si des intégrations externes le nécessitent.

---

## Ordre d'implémentation recommandé

```
E09-001 (service wallet — types, Stripe wrapper, DB queries)
   ↓
E09-002 (dashboard UI — page wallet complète)
   ↓
E09-003 (retrait manuel — modal + server action)
   ↓
┌─────────────────────────────────────────────────────┐
│ Parallélisables (P1) :                              │
│ E09-004 (payout schedule → page /account/stripe-connect) │
│ E09-005 (webhooks payout.paid / payout.failed)      │
│ E09-006 (export CSV)                                │
│ E09-007 (ventes par film)                           │
└─────────────────────────────────────────────────────┘
   ↓
E09-008 (tests — en continu pendant le dev)
```

Phase 1 (P0) : E09-001 → E09-002 → E09-003
Phase 2 (P1) : E09-004, E09-005, E09-006, E09-007 (parallélisables, aucune dépendance entre eux)
Phase 3 : E09-008 (tests, en continu pendant le dev — ne pas attendre la fin)

---

## Inventaire i18n

### Clés existantes (déjà dans `messages/en.json` et `messages/fr.json`)

```
wallet.title                          ✅
wallet.available                      ✅
wallet.pending                        ✅
wallet.thisMonth                      ✅
wallet.withdraw                       ✅
wallet.withdrawModal.title            ✅
wallet.withdrawModal.amount           ✅
wallet.withdrawModal.available        ✅  (avec placeholder {amount})
wallet.withdrawModal.delay            ✅
wallet.withdrawModal.confirm          ✅
wallet.autoPayoutTitle                ✅  → déplacer vers stripeConnect.payoutSchedule.title
wallet.autoPayoutEnable               ✅  → déplacer vers stripeConnect.payoutSchedule.enable
wallet.autoPayoutFrequency            ✅  → déplacer vers stripeConnect.payoutSchedule.frequency
wallet.autoPayoutFrequencies.daily    ✅  → déplacer vers stripeConnect.payoutSchedule.frequencies.daily
wallet.autoPayoutFrequencies.weekly   ✅  → déplacer vers stripeConnect.payoutSchedule.frequencies.weekly
wallet.autoPayoutFrequencies.monthly  ✅  → déplacer vers stripeConnect.payoutSchedule.frequencies.monthly
wallet.autoPayoutMinimum              ✅  → (hors scope P0, mais garder)
wallet.transactions.title             ✅
wallet.transactions.columns.date      ✅
wallet.transactions.columns.film      ✅
wallet.transactions.columns.exhibitor ✅  (libellé correct — c'est bien l'exploitant qui achète)
wallet.transactions.columns.gross     ✅
wallet.transactions.columns.commission ✅
wallet.transactions.columns.net       ✅
wallet.transactions.columns.status    ✅  → (supprimer — pas de colonne statut en P0)
wallet.transactions.status.pending    ✅  → (supprimer — pas de statut en P0)
wallet.transactions.status.available  ✅  → (supprimer — pas de statut en P0)
wallet.transactions.status.paid_out   ✅  → (supprimer — pas de statut en P0)
wallet.payouts.title                  ✅
wallet.payouts.download               ✅
wallet.payouts.status.initiated       ✅
wallet.payouts.status.in_transit      ✅
wallet.payouts.status.paid            ✅
wallet.payouts.status.failed          ✅
```

### Clés à ajouter

```
# Wallet — dashboard
wallet.previousMonth                  "Previous month" / "Mois précédent"
wallet.withdrawButton                 "Withdraw funds" / "Retirer les fonds"
wallet.noBankAccountTooltip           "Configure your bank account via the Stripe dashboard first" / "Configurez votre compte bancaire via le dashboard Stripe"

# Wallet — bannière Stripe Express
wallet.stripeBanner.text              "To manage your bank details, statements and tax documents, access your Stripe dashboard." / "Pour gérer vos coordonnées bancaires, relevés et documents fiscaux, accédez à votre dashboard Stripe."
wallet.stripeBanner.button            "Access dashboard" / "Accéder au dashboard"

# Wallet — graphique revenus
wallet.revenue.title                  "Revenue evolution" / "Évolution des revenus"
wallet.revenue.period30d              "30 days" / "30 jours"
wallet.revenue.period12m              "12 months" / "12 mois"
wallet.revenue.empty                  "No revenue for this period" / "Aucun revenu sur cette période"

# Wallet — transactions (compléments)
wallet.transactions.columns.orderNumber  "Order" / "Commande"
wallet.transactions.empty             "No transactions yet" / "Aucune transaction"
wallet.transactions.next              "Next" / "Suivant"
wallet.transactions.previous          "Previous" / "Précédent"

# Wallet — payouts (compléments)
wallet.payouts.columns.date           "Date" / "Date"
wallet.payouts.columns.amount         "Amount" / "Montant"
wallet.payouts.columns.status         "Status" / "Statut"
wallet.payouts.columns.arrivalDate    "Arrival date" / "Date d'arrivée"
wallet.payouts.status.canceled        "Canceled" / "Annulé"
wallet.payouts.empty                  "No payouts yet" / "Aucun virement"

# Wallet — retrait (compléments)
wallet.withdrawModal.success          "Withdrawal confirmed" / "Retrait confirmé"
wallet.withdrawModal.successDetail    "Your withdrawal of {amount} will arrive by {date}" / "Votre retrait de {amount} arrivera le {date}"
wallet.withdrawModal.currencySelect   "Currency" / "Devise"

# Wallet — erreurs
wallet.errors.insufficientBalance     "Insufficient balance for this amount" / "Solde insuffisant pour ce montant"
wallet.errors.noBankAccount           "No bank account configured. Add one in your Stripe dashboard." / "Aucun compte bancaire configuré. Ajoutez-en un dans votre dashboard Stripe."
wallet.errors.bankAccountClosed       "Your bank account has been closed. Update your details in the Stripe dashboard." / "Votre compte bancaire est fermé. Mettez à jour vos coordonnées dans le dashboard Stripe."
wallet.errors.payoutFailed            "Payout failed. Please try again or contact support." / "Le virement a échoué. Réessayez ou contactez le support."
wallet.errors.onboardingIncomplete    "Complete your Stripe onboarding before withdrawing funds." / "Complétez votre onboarding Stripe avant de retirer des fonds."

# Wallet — export CSV
wallet.csv.download                   "Download statement" / "Télécharger le relevé"
wallet.csv.currentMonth               "Current month" / "Mois en cours"
wallet.csv.previousMonth              "Previous month" / "Mois précédent"
wallet.csv.custom                     "Custom range" / "Période personnalisée"

# Wallet — onboarding guard
wallet.onboarding.title               "Stripe account required" / "Compte Stripe requis"
wallet.onboarding.description         "Complete your Stripe Connect setup to access your wallet and receive payments." / "Complétez la configuration de votre compte Stripe Connect pour accéder à votre portefeuille et recevoir des paiements."
wallet.onboarding.cta                 "Set up Stripe Connect" / "Configurer Stripe Connect"

# Stripe Connect — payout schedule (nouvelles clés pour E09-004)
stripeConnect.payoutSchedule.title    "Automatic payouts" / "Virements automatiques"
stripeConnect.payoutSchedule.enable   "Enable automatic payouts" / "Activer les virements automatiques"
stripeConnect.payoutSchedule.frequency  "Frequency" / "Fréquence"
stripeConnect.payoutSchedule.frequencies.daily   "Daily" / "Quotidien"
stripeConnect.payoutSchedule.frequencies.weekly  "Weekly" / "Hebdomadaire"
stripeConnect.payoutSchedule.frequencies.monthly "Monthly" / "Mensuel"
stripeConnect.payoutSchedule.weeklyAnchor  "Day of the week" / "Jour de la semaine"
stripeConnect.payoutSchedule.monthlyAnchor "Day of the month" / "Jour du mois"
stripeConnect.payoutSchedule.save     "Save" / "Enregistrer"
stripeConnect.payoutSchedule.success  "Payout schedule updated" / "Configuration des virements mise à jour"

# Films — transactions par film (E09-007)
films.transactions.title              "Sales" / "Ventes"
films.transactions.totalSales         "{count} sales" / "{count} ventes"
films.transactions.totalRevenue       "Total revenue: {amount}" / "Revenu total : {amount}"
films.transactions.columns.date       "Date" / "Date"
films.transactions.columns.cinema     "Cinema" / "Cinéma"
films.transactions.columns.orderNumber "Order" / "Commande"
films.transactions.columns.gross      "Gross" / "Brut"
films.transactions.columns.commission "Commission" / "Commission"
films.transactions.columns.net        "Net" / "Net"
films.transactions.empty              "No sales for this film" / "Aucune vente pour ce film"
```

> **Note** : les clés `wallet.autoPayout*` existantes seront déplacées vers `stripeConnect.payoutSchedule.*` et les clés `wallet.transactions.status.*` / `wallet.transactions.columns.status` seront supprimées (pas de colonne statut en P0).

---

## Notes techniques

### Stripe Connect Express — limites liées au wallet

- **Balance** : `stripe.balance.retrieve({ stripeAccount })` retourne les soldes par devise dans deux tableaux : `available[]` et `pending[]`. Chaque entrée a `{ amount: number, currency: string }`. Un ayant droit avec des films en EUR et USD aura deux entrées.
- **Payouts** : `stripe.payouts.create({ amount, currency }, { stripeAccount })` — le payout est dans une seule devise. Si multi-devise, un payout par devise. Le montant max = le `amount` dans l'entrée `available` correspondant à cette devise.
- **Payout schedule** : modifiable via `stripe.accounts.update()`. Les comptes Express nouvellement créés ont par défaut un schedule `daily` avec une période de rétention (rolling 2-7 jours selon le pays).
- **External accounts** (comptes bancaires) : gérés par Stripe lors de l'onboarding KYC. L'ayant droit peut ajouter/modifier son compte via le dashboard Express (lien `createStripeConnectDashboardLink()`). TIMELESS ne gère pas les comptes bancaires directement.
- **Transfers vs Payouts** : un **transfer** est de la plateforme vers le compte Connect (E08). Un **payout** est du compte Connect vers le compte bancaire de l'ayant droit (E09). Ce sont deux flux distincts.
- **Transfers.list** : appelé **depuis la plateforme** avec `stripe.transfers.list({ destination: connectAccountId })` — renvoie les transfers de la plateforme vers ce Connect account. Le `metadata.order_item_id` est disponible sur chaque transfer.

### Enrichissement des transactions (algorithme batch)

```
1. transfers = stripe.transfers.list({ destination, limit: 10, starting_after? })
2. orderItemIds = transfers.map(t => t.metadata.order_item_id).filter(Boolean)
3. enrichments = db.select({ ... })
     .from(orderItems)
     .innerJoin(films, eq(orderItems.filmId, films.id))
     .innerJoin(cinemas, eq(orderItems.cinemaId, cinemas.id))
     .innerJoin(orders, eq(orderItems.orderId, orders.id))
     .where(inArray(orderItems.id, orderItemIds))
4. enrichmentMap = new Map(enrichments.map(e => [e.orderItems.id, e]))
5. Pour chaque transfer : fusionner avec enrichmentMap.get(transfer.metadata.order_item_id)
6. Si pas d'enrichment (transfer sans metadata, ou order item supprimé) : afficher le transfer avec "Film inconnu" / "Cinéma inconnu"
```

Une seule query DB pour N transfers (pas de N+1).

### Devise : `orderItems.currency` vs balance Stripe

- **`orderItems.currency`** = devise de l'exploitant (la devise dans laquelle le CheckoutSession a été créé). C'est aussi la devise du `transfer` créé vers le compte Connect.
- **Balance Stripe** = Stripe convertit automatiquement les transfers vers la devise du compte Connect (définie par le pays de l'onboarding). Un transfer en GBP vers un compte français (EUR) sera converti en EUR par Stripe.
- **Conséquence** : les montants dans `orderItems.rightsHolderAmount` sont dans la devise de l'exploitant, mais le solde Stripe est dans la devise du compte Connect. Ces montants peuvent différer si there's a conversion.
- **Pour les KPI revenue (DB)** : grouper par `orderItems.currency` pour ne pas sommer des devises différentes.
- **Pour les soldes (Stripe API)** : les montants sont déjà dans la devise du compte (ou plusieurs devises si le compte a des fonds non convertis).

### Cache et performance

Les appels Stripe API (`balance.retrieve`, `transfers.list`, `payouts.list`) sont faits à chaque page load / pagination. Pas de cache local en P0. L'appel `balance.retrieve` est très rapide (~50ms). `transfers.list` et `payouts.list` sont rapides aussi (~100ms) pour 10 items.

Si les appels deviennent trop lents (> 2s), envisager :
- Un cache en mémoire courte durée (30s) pour le solde (via `unstable_cache` de Next.js ou un cache en mémoire simple)
- Une table `walletTransactionsCache` synchronisée par webhook `transfer.created`

### Pagination curseur Stripe — pattern technique

```typescript
// Forward pagination
const result = await stripe.transfers.list({
  destination: stripeConnectAccountId,
  limit: 10,
  ...(startingAfter ? { starting_after: startingAfter } : {}),
});

return {
  transactions: enriched,
  hasMore: result.has_more,           // Stripe boolean
  nextCursor: result.data.at(-1)?.id, // ID du dernier transfer = cursor pour la page suivante
};
```

Le client stocke les pages dans un `useRef<WalletTransaction[][]>([])` :
- "Suivant" → appel server action avec cursor → push la nouvelle page
- "Précédent" → décrémente l'index de page (pas d'appel API — données en cache)
- Reset au retour à la page 0 si les données ont changé

### Fichier email dédié

Créer `src/lib/email/wallet-emails.ts` avec 4 fonctions :
1. `sendWithdrawalConfirmationEmail()` — E09-003
2. `sendPayoutPaidEmail()` — E09-005
3. `sendPayoutFailedEmail()` — E09-005
4. `sendOpsPayoutFailedEmail()` — E09-005

Pattern identique à `order-emails.ts` : HTML inline, `safeEmail()`, `formatAmount()` pour les montants.

### Tests E2E — compte Stripe Connect de test

Le compte `acct_1T9Xa2Fg5bm7UN8b` est un compte Express existant en mode test Stripe. Il est utilisé pour tous les tests E2E du wallet. **Il ne doit jamais être supprimé.** Le helper E2E `setupRightsHolderWithStripeAccount()` crée un utilisateur RH en DB avec ce `stripeConnectAccountId` pré-configuré, permettant de tester les appels Stripe réels (balance, transfers, payouts) sans créer de nouveau compte à chaque run.

### Dépendance npm : recharts

Ajouter `recharts` en dépendance projet (`pnpm add recharts`). recharts est la librairie de graphiques standard React (~45KB gzipped). Composants utilisés : `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`. Compatible SSR. Pas besoin de `next/dynamic` — recharts utilise `<svg>`, pas `<canvas>`.

---

## Points ouverts

1. **Seuil minimum de payout** : Stripe Connect Express ne le supporte pas nativement. Implémenter un seuil côté TIMELESS nécessiterait de bloquer les payouts automatiques (`interval: "manual"`) et d'utiliser un cron pour vérifier le solde. → **Reporté post-MVP.**
2. **Refunds impact sur le wallet** : un remboursement (E11) crée un reversal du transfer. Le solde du compte Connect sera débité automatiquement par Stripe. Le wallet reflétera automatiquement le solde diminué (pas de table locale). → **À documenter dans E11.**
3. **Production : webhook Connect** : en production, il faudra un second webhook endpoint ou un second secret (`STRIPE_CONNECT_WEBHOOK_SECRET`) pour les événements Connect. À configurer lors du déploiement. → **À traiter lors du déploiement prod.**
4. **Statut par transaction post-MVP** : si on veut réintroduire un statut par transaction (pending/available/paid_out), la meilleure approche serait un webhook `transfer.created` + `balance_transaction.available_on` stocké en local, permettant de déduire le statut sans N+1 API calls en temps réel. → **Reporté post-MVP.**
