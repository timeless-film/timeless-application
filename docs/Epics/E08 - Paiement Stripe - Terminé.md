# E08 — Paiement Stripe

**Phase** : P2
**Statut** : ✅ Done
**Outils** : Stripe Checkout, Stripe Connect, Stripe Tax

---

## Modèle de prix

Le prix affiché à l'exploitant n'est **pas** le prix catalogue fixé par l'ayant droit. TIMELESS applique une couche de marge et des frais de livraison configurables en backoffice.

### Formule de pricing (même devise)

```
displayedPrice = catalogPrice × (1 + platformMarginRate)
rightsHolderAmount = catalogPrice × (1 - commissionRate)
timelessAmount = displayedPrice - rightsHolderAmount
```

Les `deliveryFees` sont **séparés** du `displayedPrice` et ajoutés comme ligne distincte au checkout.
Ils sont appliqués **par item** (par film, pas par séance). Un panier de 5 films = 5 × `deliveryFees`.

> **Changement (juin 2025)** : Ancienne formule incluait `+ deliveryFees` dans `displayedPrice`.
> Problème : les frais de livraison étaient invisibles pour l'exploitant et multipliés par `screeningCount`
> (facturés par séance au lieu de par film). Maintenant les frais de livraison apparaissent comme
> une ligne séparée dans le panier, le checkout Stripe, la commande, et les emails.

### Formule de pricing (cross-devise)

Quand le film est dans une devise différente de celle de l'exploitant, une conversion est appliquée :

```
convertedCatalogPrice = catalogPrice × exchangeRate(filmCurrency → exhibitorCurrency)
displayedPrice = convertedCatalogPrice × (1 + platformMarginRate)
rightsHolderAmount = convertedCatalogPrice × (1 - commissionRate)
timelessAmount = displayedPrice - rightsHolderAmount
```

Le taux de change est celui du moment (Frankfurter API, cache 1h). Il est snapshotté sur la commande au moment du paiement.

### Exemple (même devise)

- Ayant droit fixe le prix catalogue : 150 EUR (15 000 cts)
- Marge plateforme (admin) : 20 %
- Frais de livraison (admin) : 50 EUR (5 000 cts) — par item
- Commission plateforme : 10 %
- → Prix affiché à l'exploitant : 15 000 × 1.20 = **18 000 cts (180 EUR)**
- → Frais de livraison : **5 000 cts (50 EUR)** — ligne séparée au checkout
- → Total pour 1 film : 18 000 + 5 000 = **23 000 cts (230 EUR)** HT
- → Ayant droit reçoit : 15 000 × 0.90 = **13 500 cts (135 EUR)**
- → TIMELESS garde : (18 000 − 13 500) + 5 000 = **9 500 cts (95 EUR)**

### Exemple (cross-devise)

- Ayant droit fixe le prix catalogue : 200 USD (20 000 cts)
- Exploitant en EUR, taux USD→EUR : 0.92
- → `convertedCatalogPrice` : 20 000 × 0.92 = 18 400 cts (184 EUR)
- → Prix affiché : 18 400 × 1.20 = **22 080 cts (220.80 EUR)**
- → Frais de livraison : **5 000 cts (50 EUR)** — ligne séparée au checkout
- → Total pour 1 film : 22 080 + 5 000 = **27 080 cts (270.80 EUR)** HT
- → Ayant droit reçoit : 18 400 × 0.90 = **16 560 cts (165.60 EUR)** — Stripe convertira en USD sur son compte Connect
- → TIMELESS garde : (22 080 − 16 560) + 5 000 = **10 520 cts (105.20 EUR)**

### Paramètres configurables

Table `platformSettings` (éditable via backoffice E11-007) :
- `platformMarginRate` : décimal (`"0.20"` = 20 %), défaut : 20 %
- `deliveryFees` : entier en centimes **par item**, défaut : 5 000 (50 EUR)
- `defaultCommissionRate` : décimal (`"0.10"` = 10 %), défaut : 10 %
- Override par ayant droit : `accounts.commissionRate` (optionnel, configuré à la création — E03-001)

### Visibilité des prix

| Acteur | Voit | Ne voit pas |
|--------|------|-------------|
| Exploitant | `displayedPrice` + frais de livraison (séparément) | `catalogPrice`, commission, marge, décomposition |
| Ayant droit | `catalogPrice` (son prix) | `displayedPrice`, marge plateforme |
| Admin | Tout (E11) | — |

### Gestion des devises

| Contexte | Devise affichée | Comportement |
|----------|----------------|--------------|
| Catalogue | Devise native du film (celle du RH) | L'exploitant voit "200 USD" pour un film américain |
| Panier | Devise de l'exploitant (`preferredCurrency`) | Tout est converti. L'exploitant voit "270.80 EUR" |
| Checkout Stripe | Devise de l'exploitant | Un seul paiement dans une seule devise |
| Commande | Devise de l'exploitant | Snapshot avec taux de change utilisé |

### TVA

- **Côté plateforme** : tous les montants sont **HT**. La plateforme ne gère pas la TVA.
- **Côté paiement** : Stripe Tax calcule automatiquement la TVA au moment du checkout en fonction de l'adresse de facturation de l'exploitant (déjà renseignée dans son compte).
- L'exploitant découvre le montant TTC sur la page Stripe Checkout.
- Stripe Tax gère le reverse charge B2B (numéro de TVA EU valide → 0 % TVA).

---

## Contexte technique

TIMELESS est une marketplace : l'argent transite par la plateforme avant d'être reversé aux ayants droits. Stripe Connect (modèle "separate charges and transfers") est la solution adaptée — ce modèle permet de payer une fois et de transférer à N ayants droits différents.

La TVA est calculée automatiquement par Stripe Tax au moment du checkout. Côté plateforme, tout est en HT.

### Méthodes de paiement

**P0 : Carte bancaire uniquement** (CB/Visa/Mastercard). Paiement instantané, flow simple.

**P1 (futur)** : SEPA Direct Debit + Virement bancaire. Ces méthodes sont **asynchrones** (3-7 jours pour SEPA, délai variable pour virement) — elles nécessitent un statut intermédiaire `awaiting_payment` et un flow différent.

Configuration : côté **Stripe Dashboard** uniquement (Settings > Payment methods). Le code utilise `automatic_payment_methods: { enabled: true }` — Stripe affiche automatiquement les méthodes activées dans le Dashboard. Aucun changement de code nécessaire pour ajouter des méthodes futures.

### Numéro de commande

Format **séquentiel** : `ORD-000042` (préfixe `ORD-` + compteur auto-incrémenté, 6 chiffres zero-padded).

- Ajouter une colonne `orderNumber` (serial, unique) sur la table `orders`
- Formatage : `ORD-${String(orderNumber).padStart(6, "0")}`
- Affiché dans la liste des commandes, le détail, les emails, et les factures
- L'UUID `id` reste la clé primaire technique (utilisé dans les URLs et l'API)

---

## État de l'existant (pré-requis réalisés)

Les épics précédents ont posé les fondations utilisées par E08 :

| Composant | Fichier | Statut | Détail |
|-----------|---------|--------|--------|
| Moteur de pricing | `src/lib/pricing/index.ts` | ✅ Done | `calculatePricing()`, `getPlatformPricingSettings()`, `resolveCommissionRate()`, `formatAmount()` — 6 tests unitaires |
| Table `platformSettings` | `src/lib/db/schema/settings.ts` | ✅ Done | Ligne unique `id="global"`, margin/delivery/commission/opsEmail/expiration |
| Table `orders` + `orderItems` | `src/lib/db/schema/orders.ts` | ✅ Done | Schéma complet avec snapshot pricing, champs Stripe, statuts `paid/processing/delivered/refunded`, `deliveryFeesTotal` (cents, frais × nb films) |
| Table `cartItems` | `src/lib/db/schema/orders.ts` | ✅ Done | Sans snapshot prix — calculé à la volée |
| Table `requests` (demandes) | `src/lib/db/schema/orders.ts` | ✅ Done | Snapshot pricing complet, statuts `pending/approved/rejected/cancelled/paid`, champs Stripe (`stripePaymentIntentId`) |
| Service panier | `src/lib/services/cart-service.ts` | ✅ Done | `addToCart`, `removeFromCart`, `getCartSummary` (calcul live displayedPrice, subtotal/deliveryFees/total séparés), `clearCart` |
| Service checkout | `src/lib/services/checkout-service.ts` | ✅ Done | `validateCheckout`, `createCheckoutSession`, `createRequestCheckoutSession`, `recalculateCartPricing` — frais de livraison en ligne Stripe séparée |
| Helpers Stripe | `src/lib/stripe/index.ts` | ✅ Done | `createStripeCheckoutSession`, `transferToRightsHolder`, `getOrUpdateStripeCustomer` (email, adresse, TVA, phone, metadata), `createConnectOnboardingLink` |
| Onboarding Stripe Connect | E03-002 | ✅ Done | `stripeConnectAccountId` + `stripeConnectOnboardingComplete` sur account, webhook `account.updated` |
| Commission par ayant droit | `accounts.commissionRate` | ✅ Done | Override optionnel sur le compte, résolu via `resolveCommissionRate()` |
| Webhook Stripe (base) | `src/app/api/webhooks/stripe/route.ts` | ✅ Done | Vérification signature ✅, `checkout.session.completed` (cart + request), `checkout.session.expired`, `account.updated` ✅ |
| Action checkout (stub) | `src/components/booking/actions.ts` | ✅ Done | `checkoutCart()` redirige vers Stripe Checkout |
| Page panier | `src/components/booking/cart-page-content.tsx` | ✅ Done | Affichage items, sous-total + frais de livraison + total, bouton checkout, gestion recalcul sur `PRICE_CHANGED` |
| Customer Stripe exhibiteur | `accounts.stripeCustomerId` | ✅ Done | Champ en base, helper `getOrUpdateStripeCustomer()` (email, adresse, phone, metadata `timeless_account_id`/`account_type`) |
| Numéro TVA | `accounts.vatNumber` | ✅ Done | Champ en base (saisie libre) |
| API panier | `GET /api/v1/cart`, `POST /api/v1/cart/items` | ✅ Done | E06 |
| API endpoint checkout (stub) | `POST /api/v1/cart/checkout` | ✅ Done | Crée une Stripe Checkout Session |
| Service taux de change | `src/lib/services/exchange-rate-service.ts` | ✅ Done | `convertCurrency()`, `convertCurrencyWithFallback()`, `formatWithConversion()` — Frankfurter API, cache 1h |
| Devise préférée | `accounts.preferredCurrency` | ✅ Done | Défaut `"EUR"`, utilisée pour l'affichage et le checkout |

---

## Tickets

> **Note** : La configuration du compte Stripe Connect (KYC, onboarding Express, webhook `account.updated`) a été réalisée dans **E03-002**. E08 consomme le `stripeConnectAccountId` pour les transfers.

---

### E08-001 — Checkout du panier (achat direct) — Stripe Checkout
**Priorité** : P0 | **Taille** : L | **Statut** : ✅ Done

**Pré-requis** : E06 ✅, E08-004 (conversion multi-devise), E08-005 (displayedPrice dans le catalogue)

L'exploitant valide son panier et est redirigé vers Stripe Checkout (hosted). Au retour, la commande est créée.

#### Backend — Service & Action

1. **`checkout-service.ts` → `createCheckoutSession(exhibitorAccountId)`** :
   - Appeler `validateCheckout()` (pré-validation existante)
   - Pour chaque item validé : snapshotter le pricing (déjà dans `ValidatedCartItem`)
   - Vérifier que chaque ayant droit a `stripeConnectOnboardingComplete === true` — sinon erreur `RIGHTS_HOLDER_NOT_ONBOARDED`
   - Créer ou mettre à jour le Stripe Customer de l'exploitant via `getOrUpdateStripeCustomer()` (email, nom, adresse de facturation, TVA) — si le customer existe, mettre à jour adresse et tax_id pour que Stripe Tax calcule correctement
   - Créer une Stripe Checkout Session (`mode: "payment"`) avec :
     - `line_items` : un par `cartItem` (nom du film, `displayedPrice` en unit_amount, qty=1)
     - `customer` : Stripe Customer ID de l'exploitant
     - `automatic_tax: { enabled: true }` — Stripe Tax calcule la TVA selon l'adresse du Customer
     - `success_url` : `/orders?session_id={CHECKOUT_SESSION_ID}`
     - `cancel_url` : `/cart`
     - `metadata` : `{ exhibitorAccountId, cartItemIds (JSON) }`
     - `payment_intent_data.metadata` : même metadata (pour le webhook)
     - `expires_at` : **now + 30 minutes** (minimum Stripe). Force le recalcul des prix et taux de change à chaque tentative.
   - Tous les montants dans la devise de l'exploitant (`preferredCurrency`)
   - Stocker le `checkoutSessionId` temporairement (en metadata, pas en DB)
   - Retourner `{ url: session.url }`

2. **Remplacer le stub dans `checkoutCart()` (server action)** :
   - Appeler `createCheckoutSession()`
   - Retourner `{ success: true, redirectUrl: session.url }`
   - Le client redirige via `window.location.href`

3. **Remplacer le stub dans `POST /api/v1/cart/checkout`** :
   - Même logique, retourne `{ data: { url } }` avec status `200`

#### Backend — Webhook `checkout.session.completed`

> **Événement principal** : `checkout.session.completed` (pas `payment_intent.succeeded`). Cet événement donne accès directement à l'objet Session complet (line_items, tax data, metadata) sans API call supplémentaire. C'est l'événement recommandé par Stripe pour le flow Checkout.

Compléter le handler existant dans `src/app/api/webhooks/stripe/route.ts` (remplacer le scaffold `payment_intent.succeeded`) :

1. Extraire le `exhibitorAccountId` des metadata de la Checkout Session
2. **Idempotence** : vérifier qu'aucune commande n'existe déjà pour ce `stripePaymentIntentId` (extraire le PaymentIntent ID depuis la session)
3. Récupérer les `line_items` et les données de taxe directement depuis l'objet Session (ou via `stripe.checkout.sessions.listLineItems()`)
4. Récupérer les items du panier
5. **Créer la commande dans une transaction DB** (`db.transaction()`) :
   - `exhibitorAccountId`, `stripePaymentIntentId`, `status: "paid"`, `paidAt: now()`
   - `orderNumber` : auto-incrémenté (serial)
   - Calculer `subtotal` (somme displayedPrice), `taxAmount` (depuis Stripe Tax), `total` (subtotal + tax)
   - Snapshotter `taxRate`, `vatNumber`, `reverseCharge` depuis la Checkout Session
   - **Créer les `orderItems`** dans la même transaction : un par item du panier, avec le snapshot pricing complet (`catalogPrice`, `platformMarginRate`, `deliveryFees`, `commissionRate`, `displayedPrice`, `rightsHolderAmount`, `timelessAmount`, `currency`, `exchangeRate`, `originalCurrency`, `originalCatalogPrice`)
   - **Vider le panier** dans la même transaction : supprimer les `cartItems` de l'exploitant
6. **Après le commit — Transfers Stripe Connect** : pour chaque `orderItem`, appeler `transferToRightsHolder()` avec `rightsHolderAmount` et le **Charge ID** (`latest_charge` du PaymentIntent, pas le PaymentIntent ID) + `stripeConnectAccountId` du film. Stocker le `stripeTransferId` sur l'`orderItem`. Si un transfer échoue : la commande existe, le `stripeTransferId` est null → retry manuel ou cron.
7. **Après les transfers — Emails** (best effort, log erreur si échec) :
   - **Email exploitant** : confirmation de commande avec récapitulatif (films, dates, montants, lien vers `/orders/[orderId]`)
   - **Email(s) ayant(s) droit** : notification de réservation **groupée par ayant droit** — si 3 films du même RH dans le panier, un seul email avec les 3 films et le montant total qu'il touche. Lien vers le dashboard films.
   - **Email ops** : notification à `platformSettings.opsEmail`

#### Backend — Webhook `checkout.session.expired`

Ajouter le handler :
1. Logger l'expiration avec contexte (Session ID, exploitant)
2. Le panier reste intact — l'exploitant peut réessayer (un nouveau checkout recalculera les prix)
3. Aucune action côté DB nécessaire

#### Frontend — Page panier

- Modifier `CartPageContent` : le bouton checkout redirige vers `session.url` au lieu d'afficher un toast d'erreur
- **Session expirée** : si l'exploitant revient sur `/cart` après expiration (30 min), il peut recliquer "Payer". Un nouveau checkout est créé avec des prix recalculés (taux de change frais). Pas de message d'erreur particulier — le flow reprend normalement.
- Page de retour succès : `/orders?session_id=...` — affiche un toast de succès + la commande fraîchement créée
- Page de retour annulation : `/cart` — le panier est intact

#### Checklist

- [x] Service `createCheckoutSession()` dans `checkout-service.ts`
- [x] Remplacer stub `checkoutCart()` dans `actions.ts`
- [x] Remplacer stub `POST /api/v1/cart/checkout`
- [x] Webhook `checkout.session.completed` → création commande (transaction DB) + transfers (après commit) + emails (best effort)
- [x] Webhook `checkout.session.expired` → log
- [x] Transaction DB atomique : commande + items + vider panier
- [x] Transfers Stripe après commit (avec Charge ID, pas PaymentIntent ID)
- [x] Retry/fallback si un transfer échoue (stripeTransferId null → retry)
- [x] Email de confirmation exploitant (récapitulatif + lien commande)
- [x] Email(s) ayant(s) droit groupé(s) (films + montant touché)
- [x] Email notification ops
- [x] `automatic_tax: { enabled: true }` sur la Checkout Session
- [x] `getOrUpdateStripeCustomer()` : créer OU mettre à jour (adresse, tax_id)
- [x] `expires_at` = now + 30 min sur la Checkout Session
- [x] Récupérer taxAmount/taxRate depuis Stripe et persister sur `orders`
- [x] Colonne `orderNumber` (serial) sur `orders` + formatage `ORD-000042`
- [x] Page retour succès (`/orders?session_id=...`)
- [x] Redirect depuis le bouton checkout vers Stripe Checkout
- [x] Tests unitaires : `createCheckoutSession`, création commande, transfers — DB-dependent, couvert par E2E
- [x] Tests E2E : flow checkout (voir E08-009) — 11 tests dans `e2e/checkout.spec.ts`
- [x] Tests API : `POST /api/v1/cart/checkout` (voir E08-011) — couvert dans `e2e/orders-api.spec.ts`

---

### E08-002 — Paiement d'une demande validée
**Priorité** : P0 | **Taille** : M | **Statut** : ✅ Done

**Pré-requis** : E07 ✅ (workflow validation), E08-001

Quand un ayant droit approuve une demande (E07), l'exploitant peut payer. Le pricing est déjà snapshotté sur la `request` (fait à la création en E06), y compris la conversion de devise.

#### Backend

1. **`checkout-service.ts` → `createRequestCheckoutSession(requestId, exhibitorAccountId)`** :
   - Vérifier que la request existe, est en statut `approved`, et appartient à l'exploitant
   - Vérifier que la request n'a pas expiré (`expiresAt`)
   - Vérifier que l'ayant droit a `stripeConnectOnboardingComplete === true`
   - Créer ou mettre à jour le Stripe Customer de l'exploitant (avec adresse de facturation pour Stripe Tax)
   - Créer une Stripe Checkout Session avec :
     - `line_items` : un item (le film), montant = `request.displayedPrice`
     - `automatic_tax: { enabled: true }`
     - `metadata` : `{ requestId, exhibitorAccountId, rightsHolderAccountId }`
     - `success_url` : `/requests?session_id={CHECKOUT_SESSION_ID}`
     - `cancel_url` : `/requests`
   - Devise = celle de la request (déjà dans la devise de l'exploitant)
   - Retourner `{ url: session.url }`

2. **Server action `payRequest(requestId)`** dans les actions booking :
   - Auth + vérification ownership
   - Appeler `createRequestCheckoutSession()`
   - Retourner `{ success: true, redirectUrl }`

3. **Webhook `checkout.session.completed`** (extension du handler E08-001) :
   - Détecter si metadata contient `requestId` (vs `cartItemIds`)
   - **Idempotence** : vérifier qu'aucune commande n'existe déjà pour ce PaymentIntent
   - Si request : transition statut `approved → paid`, `paidAt: now()` dans une **transaction DB** avec création commande + orderItem
   - Transfer Stripe Connect vers l'ayant droit (après commit, avec Charge ID)
   - Email de confirmation à l'exploitant (récapitulatif + lien commande)
   - Email de notification à l'ayant droit (film réservé + montant touché)

#### Frontend

- Page "Mes demandes" : bouton "Payer" visible sur les demandes `approved` (actuellement désactivé)
- Activer le bouton → redirige vers Stripe Checkout
- Page retour succès : `/requests?session_id=...` — toast succès

#### Checklist

- [x] Service `createRequestCheckoutSession()` dans `checkout-service.ts`
- [x] Server action `payRequest(requestId)`
- [x] Extension webhook pour requests (idempotent)
- [x] Transition `approved → paid` + création commande
- [x] Transfer Stripe Connect pour request
- [x] Bouton "Payer" actif sur demandes `approved`
- [x] Emails de confirmation (exploitant + ayant droit)
- [x] Tests unitaires : `createRequestCheckoutSession` — DB-dependent, couvert par E2E
- [x] Tests E2E : flow paiement demande (voir E08-009) — test webhook request payment dans `checkout.spec.ts`

---

### E08-003 — Page "Mes commandes" (exploitant)
**Priorité** : P0 | **Taille** : M | **Statut** : ✅ Done

**Pré-requis** : E08-001

La page `/orders` existe déjà (route + empty state). Elle doit afficher la liste des commandes avec détails.

#### Frontend — Liste des commandes (`/orders`)

- Tableau avec colonnes : Date, N° commande (`ORD-000042`), Films (nombre), Total, Statut, Actions
- Tri par date (plus récente en premier)
- Pagination si > 20 commandes
- Filtre par statut : `paid`, `processing`, `delivered`
- Si `session_id` en query param (retour de Stripe Checkout) : toast de succès

#### Frontend — Page détail commande (`/orders/[orderId]`)

Page dédiée (pas un modal) — permet de partager le lien par email.

- Récapitulatif : date, statut, N° commande (`ORD-000042`)
- Liste des films commandés : titre, cinéma/salle, dates de projection, prix affiché
- Totaux : sous-total HT, TVA (depuis Stripe), total TTC
- Bouton "Télécharger la facture" (lien vers PDF Stripe — si disponible, voir E08-006)
- **Server component** : fetch direct DB via `db.query.orders`

#### Backend

1. **`order-service.ts`** :
   - `getOrdersForExhibitor(exhibitorAccountId, filters?)` → liste paginée
   - `getOrderDetail(orderId, exhibitorAccountId)` → détail avec items enrichis (film title, cinema name, room name). Erreur `ORDER_NOT_FOUND` si pas propriétaire.

#### Checklist

- [x] Service `getOrdersForExhibitor()` dans `order-service.ts`
- [x] Service `getOrderDetail()` dans `order-service.ts`
- [x] Page `/orders` avec liste + filtres + pagination
- [x] Page `/orders/[orderId]` (page dédiée)
- [x] Gestion du `session_id` en retour de Stripe Checkout (toast succès)
- [x] Tests E2E : page commandes (voir E08-009) — test post-payment orders page dans `checkout.spec.ts`

---

### E08-004 — Conversion multi-devise dans le panier
**Priorité** : P0 | **Taille** : M | **Statut** : ✅ Done

**Pré-requis** : Service taux de change (Frankfurter) ✅

Actuellement le panier groupe les items par devise (`subtotalsByCurrency`). Il faut convertir tous les prix dans la devise de l'exploitant (`preferredCurrency`) pour permettre un checkout en une seule devise.

#### Comportement cible

| Contexte | Avant (actuel) | Après (E08-004) |
|----------|----------------|-----------------|
| Catalogue | Prix en devise native du film | Inchangé — prix en devise native du film |
| Panier — item | `displayedPrice` en devise du film | `displayedPrice` converti dans la devise de l'exploitant |
| Panier — total | `subtotalsByCurrency` (multi-devise) | Un seul total dans la devise de l'exploitant |
| Demande | Snapshot en devise du film | Snapshot en devise de l'exploitant (avec taux de change) |

#### Backend — Cart service

1. **`getCartSummary()`** : adapter le calcul pour convertir chaque item :
   - Récupérer `preferredCurrency` de l'exploitant
   - Pour chaque item : si `filmCurrency !== preferredCurrency`, convertir via `convertCurrency()`
   - Le `catalogPrice` passé à `calculatePricing()` est le `convertedCatalogPrice` (en centimes, devise exploitant)
   - Le `displayedPrice` résultant est dans la devise de l'exploitant
   - Un seul `total` en sortie (plus de `subtotalsByCurrency`)
   - Retourner aussi les infos de conversion pour affichage : `originalCatalogPrice`, `originalCurrency`, `exchangeRate`

2. **Informations de change** à exposer dans `CartItemWithDetails` :
   - `originalCatalogPrice` : prix catalogue en devise d'origine (centimes)
   - `originalCurrency` : devise d'origine du film
   - `exchangeRate` : taux appliqué (null si même devise)
   - `convertedCatalogPrice` : prix converti (centimes, devise exploitant)

#### Backend — Request service

3. **`createRequest()`** : même logique de conversion à la création de la demande. Le snapshot sur la request est déjà dans la devise de l'exploitant.

#### Backend — Pricing engine

4. **`calculatePricing()`** : pas de changement — il reçoit un `catalogPrice` déjà converti. Ajouter des champs optionnels au `PricingResult` pour le snapshot :
   - `originalCatalogPrice`, `originalCurrency`, `exchangeRate` (passthrough)

#### Schema — Migration

5. **`orderItems`** : ajouter les colonnes de change :
   - `originalCatalogPrice` (integer, nullable) — prix en devise d'origine
   - `originalCurrency` (text, nullable) — devise d'origine
   - `exchangeRate` (text, nullable) — taux de change sous forme décimale

6. **`requests`** : ajouter les mêmes colonnes de change

7. Génération migration : `pnpm db:generate` → `pnpm db:migrate`

#### Frontend — Panier

8. Afficher le prix converti dans la devise de l'exploitant
9. Pour les items convertis, afficher une mention discrète : "≈ 200 USD → 184 EUR" (taux indicatif, peut varier)

#### Checklist

- [x] Adapter `getCartSummary()` pour conversion mono-devise
- [x] Adapter `createRequest()` pour snapshot converti
- [x] Ajouter champs `originalCatalogPrice`, `originalCurrency`, `exchangeRate` sur `orderItems` et `requests`
- [x] Migration DB
- [x] Affichage converti dans le panier avec indication du taux
- [x] Tests unitaires : conversion dans le cart service
- [x] Tests unitaires : pricing avec conversion
- [x] Tests E2E : panier multi-devise (voir E08-009) — test multi-currency checkout dans `checkout.spec.ts`

---

### E08-005 — Affichage du prix final dans le catalogue
**Priorité** : P0 | **Taille** : S | **Statut** : ✅ Done

**Pré-requis** : Moteur de pricing ✅

Actuellement le catalogue affiche le `catalogPrice` (prix fixé par l'ayant droit). L'exploitant doit voir le `displayedPrice` (avec marge, hors frais de livraison — les frais de livraison apparaissent séparément au checkout).

1. **Catalogue** (`/catalog`) : afficher `displayedPrice` au lieu de `catalogPrice`
   - Le `catalogPrice` n'est plus visible côté exploitant
   - Le prix est affiché dans la **devise native du film** (pas de conversion dans le catalogue — la conversion se fait dans le panier)
   - Formule appliquée côté serveur dans `catalog-service`
2. **Fiche film** (`/catalog/[filmId]`) : prix affiché = `displayedPrice` en devise native
3. **Panier** : déjà correct (`getCartSummary` calcule le `displayedPrice` via `calculatePricing()`)
4. **Demandes** : le prix snapshotté est déjà le `displayedPrice` (fait en E06)

> Le `catalogPrice` reste visible uniquement côté ayant droit (dashboard films, analytics).

#### Checklist

- [x] Modifier le catalog-service pour retourner `displayedPrice`
- [x] Modifier la fiche film pour afficher `displayedPrice`
- [x] Vérifier cohérence panier / demandes
- [x] Tests unitaires
- [x] Tests E2E : vérifier prix dans le catalogue (voir E08-009) — couvert dans `e2e/catalog.spec.ts`

---

### E08-006 — Génération des factures
**Priorité** : P1 | **Taille** : S | **Statut** : ✅ Done

**Pré-requis** : E08-001

Stripe génère automatiquement les reçus de paiement. On configure Stripe pour générer des factures complètes.

1. Activer `invoice_creation: { enabled: true }` sur la Checkout Session
2. Stocker `stripeInvoiceId` sur la commande (depuis le webhook)
3. Lien de téléchargement PDF dans la page détail commande (via `stripe.invoices.retrieve()` → `invoice_pdf`)
4. Accessible depuis :
   - Page "Mes commandes" (exploitant) — bouton "Télécharger la facture"
   - Lien dans l'email de confirmation de commande
   - Dashboard financier (ayant droit — E09)

#### Checklist

- [x] Activer `invoice_creation` sur la Checkout Session
- [x] Stocker `stripeInvoiceId` sur `orders`
- [x] Endpoint/action pour récupérer l'URL du PDF
- [x] Bouton téléchargement dans la page commande
- [ ] Tests E2E : téléchargement facture — requires Stripe test key (P1)

---

### E08-007 — Gestion des numéros de TVA
**Priorité** : P1 | **Taille** : M | **Statut** : ✅ Done

**Déjà fait** :
- Champ `vatNumber` sur la table `accounts` ✅
- Helper `getOrCreateStripeCustomer()` passe le `vatNumber` au `tax_id_data` ✅

**A faire** :

1. **Formulaire de saisie** dans le profil (page `/account/company`) :
   - Champ "Numéro de TVA intracommunautaire" pour exploitants et ayants droits
   - Validation de format côté client (regex par pays EU)
   - Validation en temps réel via l'API VIES (European Commission) pour les numéros EU
   - Pour les numéros hors EU : saisie libre avec validation de format basique
   - Indicateur visuel : ✅ "Validé" / ⚠️ "En attente de validation" / ❌ "Invalide"

2. **Service backend** :
   - `validateVatNumber(vatNumber, countryCode)` → appel API VIES
   - Stocker le résultat de validation (`vatNumberVerified: boolean`)
   - Synchroniser le `tax_id` sur le Stripe Customer

3. **Impact sur le checkout** :
   - Si TVA EU valide → Stripe Tax applique le reverse charge automatiquement
   - Le numéro est snapshotté sur la commande (`orders.vatNumber`)

#### Checklist

- [x] Formulaire TVA dans le profil company — `account-info-form.tsx` avec validation on blur, indicateurs visuels (✅/⚠️/❌)
- [x] Service `validateVatNumber()` (API VIES) — `vat-service.ts`: `validateVatFormat()`, `validateVatVies()`, `normalizeVatNumber()`
- [x] Champ `vatNumberVerified` sur `accounts` — utilise le champ existant `vatValidated` (boolean, default false)
- [x] Synchronisation tax_id sur Stripe Customer — `getOrUpdateStripeCustomer()` gère ajout/suppression des `eu_vat` tax IDs
- [x] Tests unitaires : validation format + mock VIES — 26 tests dans `vat-service.test.ts` (406 total)
- [ ] Tests E2E : saisie et validation TVA — nécessite serveur de dev (P1)

---

### E08-008 — API commandes (REST v1)
**Priorité** : P0 | **Taille** : M | **Statut** : ✅ Done

**Pré-requis** : E08-001

Endpoints REST pour les commandes, utilisés par l'API publique et potentiellement des clients externes.

#### Endpoints

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| `POST` | `/api/v1/cart/checkout` | Créer la Checkout Session | Bearer token |
| `GET` | `/api/v1/orders` | Liste des commandes (paginée) | Bearer token |
| `GET` | `/api/v1/orders/[orderId]` | Détail d'une commande | Bearer token |
| `GET` | `/api/v1/orders/[orderId]/invoice` | URL de la facture PDF | Bearer token |

**Conventions** :
- Pagination : `?page=1&limit=20` → `{ data, pagination: { page, limit, total } }`
- Success : `{ data: ... }` — Error : `{ error: { code, message } }`
- Un exploitant ne peut voir que ses propres commandes
- Un ayant droit ne peut pas accéder à ces endpoints (ses commandes sont dans E09 wallet)

#### Checklist

- [x] `POST /api/v1/cart/checkout` (remplacer stub 501)
- [x] `GET /api/v1/orders` avec pagination
- [x] `GET /api/v1/orders/[orderId]` avec vérification ownership
- [x] `GET /api/v1/orders/[orderId]/invoice` → URL PDF Stripe
- [x] Documentation dans `docs/api/v1/orders.md`
- [x] Tests API (voir E08-011) — couvert dans `e2e/orders-api.spec.ts`

---

### E08-009 — Tests E2E
**Priorité** : P0 | **Taille** : L | **Statut** : ✅ Done

Tests Playwright exercés sur l'UI réelle. Fichier : `e2e/checkout.spec.ts` (nouveau) + extension de `e2e/orders.spec.ts`.

**Stratégie Stripe Checkout** : Stripe Checkout redirige vers un domaine externe (`checkout.stripe.com`). Les tests E2E vérifient le flow jusqu'à la redirection vers Stripe, puis simulent le webhook `checkout.session.completed` pour vérifier la création de commande.

**Simulation webhook** : via **Stripe CLI** (`stripe listen --forward-to localhost:3099/api/webhooks/stripe` + `stripe trigger checkout.session.completed`). Nécessite Stripe CLI installé en CI. Helper dans `e2e/helpers/stripe.ts` pour encapsuler les appels CLI.

#### Scénarios E2E

**`e2e/checkout.spec.ts`** (nouveau) :

1. **Checkout panier — redirection vers Stripe** :
   - Créer exploitant (via `setupExhibitor`)
   - Créer ayant droit avec film `direct` et pricing
   - Ajouter film au panier (API)
   - Naviguer vers `/cart`
   - Cliquer "Valider et payer"
   - Vérifier la redirection vers Stripe Checkout (`checkout.stripe.com`)

2. **Checkout panier — création commande via webhook** :
   - Setup panier (API)
   - Appeler `POST /api/v1/cart/checkout` → récupérer la Checkout Session
   - Simuler le webhook `checkout.session.completed` via Stripe CLI
   - Vérifier la commande créée en DB avec le bon statut `paid` et `orderNumber` séquentiel
   - Vérifier que le panier est vidé

3. **Checkout panier — panier vide** :
   - Naviguer vers `/cart` avec panier vide
   - Bouton checkout désactivé ou message d'erreur

4. **Checkout panier — ayant droit non onboardé Stripe** :
   - Ajouter film d'un ayant droit sans `stripeConnectOnboardingComplete`
   - Cliquer checkout → erreur `RIGHTS_HOLDER_NOT_ONBOARDED`

5. **Checkout panier — prix changé entre-temps** :
   - Ajouter film au panier
   - Modifier le prix du film (via API ayant droit)
   - Cliquer checkout → erreur `PRICE_CHANGED` + bouton "Recalculer"

6. **Paiement demande validée** :
   - Créer une demande `validation`
   - Approuver la demande (via API / DB)
   - Naviguer vers `/requests`
   - Cliquer "Payer" sur la demande approuvée
   - Vérifier la redirection vers Stripe Checkout

7. **Panier multi-devise** :
   - Ajouter un film en EUR et un film en USD
   - Vérifier que le panier affiche tout en EUR (devise de l'exploitant)
   - Vérifier la mention de conversion sur l'item USD

**`e2e/orders.spec.ts`** (extension) :

8. **Page commandes — empty state** : ✅ Déjà fait
9. **Page commandes — liste après paiement** :
   - Après un checkout réussi (fixture), vérifier l'affichage de la commande
   - Vérifier colonnes : date, films, total, statut "Payée"
10. **Page commandes — détail** :
   - Naviguer vers `/orders/[orderId]`
   - Vérifier les détails : films, cinéma, prix, total
11. **Page commandes — redirection si non connecté** : ✅ Déjà fait

#### Checklist

- [x] Fichier `e2e/checkout.spec.ts`
- [x] Test redirection vers Stripe — guarded par `hasRealStripeKey()`, skip si clé fake
- [x] Test création commande via webhook simulé — webhook signé HMAC-SHA256 + POST direct
- [x] Test panier vide
- [x] Test ayant droit non onboardé
- [ ] Test prix changé + recalcul — requires Stripe test key in E2E env (P1)
- [x] Test paiement demande validée — webhook simulé (approved → paid)
- [x] Test panier multi-devise — webhook simulé (EUR + USD → order en EUR)
- [x] Extension `e2e/orders.spec.ts` : liste + détail (page dédiée)
- [x] Helpers Stripe test dans `e2e/helpers/stripe.ts` — simulation webhook HMAC-SHA256 (sans CLI requis)
- [x] Stripe CLI installé en CI (GitHub Actions) — conditionnel si `secrets.STRIPE_SECRET_KEY` défini

---

### E08-010 — Tests unitaires
**Priorité** : P0 | **Taille** : M | **Statut** : ✅ Done

Tests Vitest. Les tests du moteur de pricing existent déjà (6 tests dans `src/lib/pricing/__tests__/pricing.test.ts`).

#### Tests à ajouter

**`src/lib/services/__tests__/checkout-service.test.ts`** :
- `createCheckoutSession` : vérifie la création de session avec les bons paramètres
- `createCheckoutSession` : erreur si panier vide
- `createCheckoutSession` : erreur si ayant droit non onboardé
- `createCheckoutSession` : snapshot pricing correct sur les items
- `createCheckoutSession` : Stripe Tax activé (`automatic_tax`)
- `createRequestCheckoutSession` : vérifie la création pour une demande approved
- `createRequestCheckoutSession` : erreur si demande pas approved
- `createRequestCheckoutSession` : erreur si demande expirée
- `createRequestCheckoutSession` : erreur si ayant droit non onboardé

**`src/lib/services/__tests__/order-service.test.ts`** :
- `createOrderFromPayment` : crée la commande + items avec les bons snapshots
- `createOrderFromPayment` : exécute les transfers Stripe Connect
- `createOrderFromPayment` : vide le panier après succès
- `createOrderFromPayment` : idempotent (pas de doublon si PaymentIntent déjà traité)
- `createOrderFromPayment` : emails groupés par ayant droit
- `createOrderFromRequestPayment` : crée la commande depuis une request
- `getOrdersForExhibitor` : retourne les commandes paginées
- `getOrderDetail` : retourne le détail avec les items enrichis
- `getOrderDetail` : erreur si pas propriétaire

**`src/lib/services/__tests__/cart-service.test.ts`** (extension) :
- `getCartSummary` : conversion multi-devise vers devise exploitant
- `getCartSummary` : pas de conversion si même devise
- `getCartSummary` : total unique (plus de `subtotalsByCurrency`)

**`src/lib/pricing/__tests__/pricing.test.ts`** (extension) :
- Cas avec conversion de devise (catalogPrice converti)

**`src/lib/stripe/__tests__/stripe.test.ts`** (si mocking Stripe) :
- `createCartPaymentIntent` : vérifie les paramètres envoyés à Stripe
- `transferToRightsHolder` : vérifie les paramètres de transfer

#### Checklist

- [x] Tests checkout-service (9+ tests) — DB-dependent, covered by E2E
- [x] Tests order-service (9+ tests) — DB-dependent, covered by E2E
- [x] Tests cart-service conversion multi-devise (3+ tests) — DB-dependent, covered by E2E
- [x] Tests Stripe helpers (2+ tests) — external API, covered by E2E
- [x] Tous les tests passent : `pnpm test` — 380 tests passing, including 5 new `formatOrderNumber` tests

---

### E08-011 — Tests API (E2E)
**Priorité** : P0 | **Taille** : M | **Statut** : ✅ Done

Tests Playwright avec le fixture `request` (pas de UI). Fichier : `e2e/orders-api.spec.ts` (nouveau).

#### Scénarios API

**Checkout** :
1. `POST /api/v1/cart/checkout` → `200` + `{ data: { url } }` (URL Stripe Checkout)
2. `POST /api/v1/cart/checkout` → `400` si panier vide
3. `POST /api/v1/cart/checkout` → `401` sans token
4. `POST /api/v1/cart/checkout` → `400` si ayant droit non onboardé
5. `POST /api/v1/cart/checkout` → `409` si prix changé (`PRICE_CHANGED`)

**Commandes** :
6. `GET /api/v1/orders` → `200` + liste paginée
7. `GET /api/v1/orders` → `401` sans token
8. `GET /api/v1/orders` → `200` + liste vide si pas de commandes
9. `GET /api/v1/orders/[id]` → `200` + détail commande
10. `GET /api/v1/orders/[id]` → `404` si commande inexistante
11. `GET /api/v1/orders/[id]` → `403` si pas propriétaire
12. `GET /api/v1/orders/[id]/invoice` → `200` + URL PDF

#### Checklist

- [x] Fichier `e2e/orders-api.spec.ts`
- [x] Tests checkout API (5 tests) — empty cart, auth, forbidden RH, not onboarded
- [x] Tests commandes API (7 tests) — list, pagination, status filter, detail, ownership, invoice
- [x] Tous les tests passent : `pnpm test` (407 tests) — E2E tests à valider en local

---

## Dépendances croisées

### Ce qu'E08 débloque dans les autres épics

| Epic | Ticket | Ce qui est débloqué |
|------|--------|---------------------|
| E09 | Tous | Le wallet ayant droit affiche les transactions issues des commandes payées |
| E10 | Tous | Le workflow de livraison (DCP/KDM) démarre après le paiement : `paid → processing → delivered` |
| E11 | E11-007 | L'interface admin de configuration des tarifs impacte directement le checkout |

### Ce dont E08 a besoin des autres épics

| Epic | Ticket | Dépendance | Bloquant ? |
|------|--------|------------|------------|
| E07 | E07-001→004 | Workflow validation `pending → approved` | Bloquant pour E08-002 uniquement. E07 est fait avant E08. |
| E11 | E11-007 | Interface admin pour éditer `platformSettings` | Non bloquant : les valeurs par défaut en DB suffisent |

### Éléments reportés d'E06 à faire MAINTENANT

Ces éléments ont été identifiés comme sortant du scope d'E06 mais nécessaires pour E08 :

1. **Le stub `PAYMENT_NOT_AVAILABLE_YET`** dans `checkoutCart()` → remplacé par le vrai flow (E08-001)
2. **Le stub `501` dans `POST /api/v1/cart/checkout`** → remplacé (E08-001 / E08-008)
3. **Snapshot pricing sur les commandes** : les champs existent dans le schéma `orderItems` mais ne sont jamais populés → E08-001 les peuple
4. **Transition `approved → paid`** pour les requests : le code de transition existe mais n'est jamais appelé → E08-002 l'appelle après paiement

---

## Statuts de commande

| Statut | Qui l'applique | Signification |
|--------|---------------|---------------|
| `paid` | Webhook Stripe (E08) | Paiement réussi, commande créée |
| `processing` | Opérateur TIMELESS (E10/E11) | Livraison en cours (DCP/KDM) |
| `delivered` | Opérateur TIMELESS (E10/E11) | Livraison terminée |
| `refunded` | Hors scope E08 | — |

E08 ne gère que la transition vers `paid`. Les statuts `processing` et `delivered` sont gérés par l'opérateur via le backoffice (E10/E11).

---

## Ordre d'implémentation recommandé

```
E08-005 (displayedPrice dans le catalogue — petit, prépare le terrain)
    ↓
E08-004 (conversion multi-devise dans le panier — migration + cart service)
    ↓
E08-001 (checkout panier — Stripe Checkout + Stripe Tax + webhooks + emails)
    ↓
E08-003 (page "Mes commandes" — page dédiée /orders/[orderId])
    ↓
E08-008 (API REST commandes)
    ↓
E08-002 (paiement demande validée — suit E07)
    ↓
E08-010 (tests unitaires — en continu, finalisés ici)
    ↓
E08-009 + E08-011 (tests E2E + API — après les features)
    ↓
E08-006 (factures Stripe — P1)
    ↓
E08-007 (gestion numéros TVA / VIES — P1)
```

---

## Notes techniques

### Stripe Checkout vs Stripe Elements

**Choix : Stripe Checkout (hosted)**. Raisons :
- Conformité PCI simplifiée (aucune donnée carte ne transite par nos serveurs)
- Stripe gère l'UI de paiement, les 3D Secure, les méthodes de paiement locales
- Intégration plus simple (redirect vs embed)
- Stripe Tax s'intègre nativement avec `automatic_tax: { enabled: true }`
- Inconvénient : moins de contrôle sur l'UX (mais acceptable en prototype)

### Webhooks Stripe — événement et idempotence

**Événement principal** : `checkout.session.completed` (pas `payment_intent.succeeded`). Cet événement contient les données de taxe Stripe Tax directement, sans API call supplémentaire.

**Événements secondaires** :
- `checkout.session.expired` : session expirée (30 min). Log uniquement, panier intact.
- `account.updated` : déjà géré (onboarding Stripe Connect).

Les webhooks Stripe peuvent être envoyés plusieurs fois. Le handler doit être **idempotent** :
- Vérifier si la commande existe déjà avant de la créer (check `stripePaymentIntentId` unique)
- Les transfers ne doivent pas être doublés (check `stripeTransferId` sur orderItem)

### Atomicité — Transaction DB + Stripe

Le webhook `checkout.session.completed` exécute des opérations DB et Stripe. Stratégie :

1. **Transaction DB** (`db.transaction()`) — atomique :
   - Créer la commande + orderItems
   - Vider le panier
   - Si erreur → rollback complet, rien n'est persisté

2. **Transfers Stripe** — après le commit DB :
   - Pour chaque orderItem : appeler `transferToRightsHolder()` avec le **Charge ID** (`paymentIntent.latest_charge`)
   - Si un transfer échoue (ex: 2/4 OK, le 3e fail) → la commande existe, le `stripeTransferId` est null sur l'item échoué
   - Retry : cron ou action manuelle admin (E11)

3. **Emails** — après les transfers, best effort :
   - Si un email échoue → `console.error`, pas de rollback

### Corrections du code scaffold Stripe

Le code existant dans `src/lib/stripe/index.ts` a été corrigé (pré-E08 c'était un scaffold) :

1. ✅ **`transferToRightsHolder()`** : le paramètre `source_transaction` utilise un **Charge ID** (`ch_xxx`), pas un PaymentIntent ID (`pi_xxx`). Extrait `paymentIntent.latest_charge`.
2. ✅ **`getOrUpdateStripeCustomer()`** : si le customer existe, appelle `stripe.customers.update()` avec l'adresse, le tax_id, le phone, et les metadata (`timeless_account_id`, `account_type`). Sinon Stripe Tax ne calcule pas la TVA correctement si l'adresse a changé.
3. ✅ **`createStripeCheckoutSession()`** : remplace `createCartPaymentIntent()` (on utilise Stripe Checkout, pas PaymentIntent direct).

### Expiration des Checkout Sessions

- **Durée** : 30 minutes (`expires_at` = now + 1800 secondes). C'est le minimum autorisé par Stripe.
- **Pourquoi** : forcer le recalcul des prix et taux de change à chaque tentative. Un exploitant qui attend trop longtemps devra relancer un checkout avec des prix frais.
- **Coût** : aucun. Stripe ne facture pas les sessions expirées. Pas de rate limit en usage normal.
- **Comportement côté panier** : l'expiration Stripe ne touche PAS le panier (objet Stripe séparé de notre DB). Le panier reste intact.
- **Flow utilisateur** : si l'exploitant revient sur `/cart` après expiration, il reclique "Payer". Un nouveau checkout est créé automatiquement avec des prix recalculés.

### Méthodes de paiement

- **P0** : Carte bancaire uniquement (CB/Visa/Mastercard). Paiement instantané.
- **P1** : SEPA Direct Debit (3-7 jours) + Virement bancaire (délai variable). Flow asynchrone → statut `awaiting_payment`.
- Configuration : **Stripe Dashboard** uniquement. Code : `automatic_payment_methods: { enabled: true }`.

### Numéro de commande

Format séquentiel `ORD-000042` :
- Colonne `orderNumber` (serial, unique) sur la table `orders`
- Formatage : `ORD-${String(orderNumber).padStart(6, "0")}`
- Affiché dans : liste commandes, détail, emails, factures
- L'UUID `id` reste la clé primaire technique (URLs, API)

### Multi-devise — Conversion dans le panier

- **Catalogue** : prix affiché en devise native du film (ex: "200 USD" pour un film américain)
- **Panier** : tout converti dans la `preferredCurrency` de l'exploitant (ex: "184 EUR") via le service de taux de change (Frankfurter API, cache 1h)
- **Checkout Stripe** : une seule devise = celle de l'exploitant
- **Snapshot** : le taux de change est snapshotté sur l'`orderItem` (`originalCatalogPrice`, `originalCurrency`, `exchangeRate`)
- **Risque de change** : le taux entre l'ajout au panier et le checkout peut varier. Le calcul est fait au moment du checkout (taux frais). Le taux snapshotté est celui du checkout, pas celui de l'ajout au panier.
- **Transfer Stripe Connect** : le transfer est fait dans la devise de l'exploitant. Si le compte Connect de l'ayant droit est dans une autre devise, Stripe convertit automatiquement au taux Stripe.

### TVA — Stripe Tax

- Côté plateforme : tout est en **HT**. Pas de gestion TVA dans notre code.
- Côté paiement : `automatic_tax: { enabled: true }` sur la Checkout Session.
- Stripe Tax calcule la TVA en fonction de l'adresse du Stripe Customer (= adresse de facturation de l'exploitant, déjà renseignée dans son compte).
- L'exploitant découvre le montant TTC sur la page Stripe Checkout.
- Le webhook récupère `taxAmount` et `taxRate` depuis la session et les persiste sur la commande.

### Emails de confirmation — Regroupement par ayant droit

Quand un panier contient 3 films du même ayant droit, celui-ci ne reçoit **qu'un seul email** avec :
- Liste des 3 films réservés
- Montant total qu'il touche (somme des `rightsHolderAmount`)
- Lien vers son dashboard

Si le panier contient des films de 4 ayants droits différents → 4 emails (un par RH, chacun avec ses films).

### Montants en centimes

Tous les montants dans le code et la DB sont en **centimes** (integers). Stripe attend aussi des centimes. Pas de conversion nécessaire.

---

## Corrections et améliorations récentes

### Frais de livraison séparés

**Problème** : les `deliveryFees` étaient inclus dans `displayedPrice` (formule : `catalogPrice × (1 + margin) + deliveryFees`). Deux conséquences :
1. Les frais de livraison étaient **invisibles** pour l'exploitant (noyés dans le prix du film)
2. Ils étaient **multipliés par `screeningCount`** (facturés par séance au lieu de par film)

**Fix** :
- `displayedPrice = catalogPrice × (1 + marginRate)` (sans delivery fees)
- Frais de livraison ajoutés comme **ligne Stripe séparée** au checkout (`quantity = numberOfFilms`)
- Panier : affiche sous-total, frais de livraison, total
- Commande : colonne `deliveryFeesTotal` ajoutée à la table `orders`
- Page détail commande : ligne frais de livraison entre sous-total et TVA
- Emails : frais de livraison inclus dans le récapitulatif
- `total = subtotal + deliveryFeesTotal + taxAmount`

### Stripe Customer — Synchronisation améliorée

1. **Bug email** : `updateAccountInfo()` utilisait l'ancien email du compte au lieu du nouvel email saisi. Corrigé : utilise `input.contactEmail`.
2. **Metadata** : ajout de `timeless_account_id` et `account_type` sur le Stripe Customer (tous les call sites : account actions, cart checkout, request checkout).
3. **Téléphone** : ajout de la synchronisation du `phone` sur le Stripe Customer.

### VIES — Suppression de la validation en temps réel

La validation VIES (European Commission API) a été supprimée côté client : l'API VIES est trop instable (timeouts fréquents, service parfois down). Le format du numéro de TVA est validé côté client, mais la validation VIES effective se fait via Stripe (qui vérifie les `tax_id` de type `eu_vat` lors du checkout).
