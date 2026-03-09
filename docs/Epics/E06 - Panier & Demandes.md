# E06 — Panier & Demandes

**Phase** : P2
**Statut global** : 🔄 En cours

---

## Contexte

Deux parcours distincts selon le type de film :

1. **Achat direct** → ajout au panier → paiement immédiat (Stripe Checkout)
2. **Validation requise** → demande envoyée à l'ayant droit → attente → si accepté → lien de paiement

Le panier ne contient que des films en **achat direct**. Les demandes en attente de validation sont dans un espace séparé "Mes demandes".

À chaque ajout (panier ou demande), l'exploitant renseigne les mêmes informations contextuelles via un modal.

---

## Fondations déjà en place

Ces éléments ont été construits (souvent dans E05) et constituent la base de cet epic :

| Élément | Fichier | Détail |
|---------|---------|--------|
| **Schéma DB** | `src/lib/db/schema/orders.ts` | Tables `cartItems`, `requests`, `orders`, `orderItems` + enums + relations |
| **Server actions** | `src/components/catalog/actions.ts` | `addToCart()`, `createRequest()`, `calculateExpirationDate()` |
| **Moteur de pricing** | `src/lib/pricing/index.ts` | `calculatePricing()`, `getPlatformPricingSettings()`, `resolveCommissionRate()` |
| **Modal UI** | `src/app/[locale]/(app)/catalog/[filmId]/film-action-modal.tsx` | Formulaire complet (cinéma, salle, dates, nb visionnages, prix indicatif) |
| **Helpers Stripe** | `src/lib/stripe/index.ts` | `createCartPaymentIntent()`, `transferToRightsHolder()`, `getOrCreateStripeCustomer()` |
| **Webhook Stripe** | `src/app/api/webhooks/stripe/route.ts` | Gestion `payment_intent.succeeded` (partiel — voir TODOs E06-003) |
| **i18n** | `messages/en.json`, `messages/fr.json` | Clés `cart.*`, `requests.*`, `orders.*`, `catalog.errors.*`, `catalog.success.*` |
| **Tests modal** | `src/lib/services/__tests__/catalog-modal-state.test.ts` | 443 lignes — couverture complète de l'état du modal |

---

## Tickets

### E06-001 — Modal d'ajout (panier ou demande) ✅ Done
**Priorité** : P0 | **Taille** : M

**Implémenté dans** :
- UI : `src/app/[locale]/(app)/catalog/[filmId]/film-action-modal.tsx`
- Actions : `src/components/catalog/actions.ts` — `addToCart()`, `createRequest()`
- Tests : `src/lib/services/__tests__/catalog-modal-state.test.ts`

**Ce qui est fait** :
- Sélecteur cinéma (filtré par territoire disponible)
- Sélecteur salle (cascadé au cinéma sélectionné)
- Champ nombre de visionnages (entier ≥ 1, obligatoire)
- Champs dates début / fin (optionnels — défaut = aujourd'hui)
- Affichage du prix total indicatif avec sélecteur de devise (conversion via Frankfurter)
- Détection de doublons (même film + cinéma + salle + dates dans le panier ou une demande active)
- Toast succès / erreurs inline

**Notes** :
- Les dates sont **optionnelles** dans l'implémentation (valeur par défaut = aujourd'hui). La spec initiale les rendait obligatoires — ce comportement est intentionnel (simplification UX validée).
- La capacité de la salle n'est pas affichée dans le sélecteur (était mentionné dans la spec initiale, décision de ne pas l'inclure pour éviter la complexité).
- Le récapitulatif avant confirmation est intégré directement dans le modal (pas d'étape séparée).

---

### E06-002 — Panier exploitant ⬜ A faire
**Priorité** : P0 | **Taille** : M

**Fichier cible** : `src/app/[locale]/(app)/cart/page.tsx` (actuellement un stub)

**À implémenter** :
- Requête DB : `cartItems` avec joins `films`, `cinemas`, `rooms`, `filmPrices`
- Liste des items avec : titre, ayant droit, cinéma, salle, dates, nb visionnages, prix unitaire (en devise native)
- Sous-total groupé par devise (si films en devises mixtes)
- Bouton "Supprimer" par ligne → server action `removeFromCart(cartItemId)`
- Bouton "Valider et payer" → vers E06-003
- État vide : message + lien vers le catalogue

**Règles métier** :
- Panier persistant (lié au compte, survit à la déconnexion) ← déjà garanti par la table `cartItems`
- Anti-doublon déjà géré à l'ajout (dans `addToCart()`)

**Service à créer** : `src/lib/services/cart-service.ts` → `getCartForAccount(accountId)`

---

### E06-003 — Validation du panier et paiement ⬜ A faire
**Priorité** : P0 | **Taille** : L

Voir E08 pour le détail du paiement Stripe.

**Fondations existantes** :
- `createCartPaymentIntent()` dans `src/lib/stripe/index.ts`
- `getOrCreateStripeCustomer()` dans `src/lib/stripe/index.ts`
- Webhook `payment_intent.succeeded` dans `src/app/api/webhooks/stripe/route.ts` (partiel)

**À implémenter** :

Flow UI :
1. Page récapitulatif final (films, prix, TVA calculée automatiquement)
2. Affichage du numéro de TVA de l'exploitant si EU (reverse charge B2B)
3. Bouton → déclenche `createCartPaymentIntent()` → redirige vers Stripe Checkout
4. Page de confirmation post-paiement → `orders` + `orderItems` créés en DB avec statut `paid`

TODOs dans le webhook (`payment_intent.succeeded`) :
- Exécuter les transferts Stripe Connect vers les ayants droits (`transferToRightsHolder()`)
- Notifier l'équipe ops TIMELESS (voir E10)
- Tracker l'événement Customer.io (voir E12)
- Vider le panier (supprimer les `cartItems` associés)

**Server action à créer** : `checkoutCart(accountId)` → construit le PaymentIntent, retourne `clientSecret`

---

### E06-004 — Espace "Mes demandes" (validation requise) ⬜ A faire
**Priorité** : P0 | **Taille** : M

**Fichier cible** : `src/app/[locale]/(app)/requests/page.tsx` (actuellement un stub)

**À implémenter** :
- Tableau de suivi avec colonnes : Film, Ayant droit, Cinéma, Dates, Statut, Expiration
- Filtrage par statut (tabs ou select) : `pending`, `validated`, `refused`, `expired`, `paid`
- Actions contextuelles :
  - Statut `pending` → bouton "Annuler" → server action `cancelRequest(requestId)`
  - Statut `validated` → bouton "Procéder au paiement" → Stripe payment link
- Pagination si nécessaire

**Statuts** (déjà dans l'enum DB `request_status`) :
- `pending` — envoyée, pas encore traitée
- `validated` — acceptée, en attente de paiement
- `refused` — refusée par l'ayant droit
- `expired` — délai dépassé
- `paid` — paiement effectué

**Clés i18n existantes** : `requests.status.*`, `requests.columns.*`, `requests.actions.*`, `requests.tabs.*`

**Service à créer** : `src/lib/services/request-service.ts` → `getRequestsForExhibitor(accountId, filters)`

---

### E06-005 — Expiration automatique des demandes ⬜ A faire
**Priorité** : P0 | **Taille** : M

**Fondation existante** :
- `calculateExpirationDate()` dans `src/components/catalog/actions.ts` — calcule `expiresAt` à la création
- Champ `expiresAt` déjà stocké dans la table `requests`

**À implémenter** :
- Job cron quotidien (route API `/api/cron/expire-requests`) appelée par un scheduler (ex. Vercel Cron)
- Logique : passer en `expired` toutes les demandes `pending` dont `expiresAt < now()`
- Notification email aux deux parties à l'expiration (voir E12)
- Protéger la route cron (secret header)

**Règles d'expiration** (déjà codées dans `calculateExpirationDate`) :
- `expiresAt = min(today + 30 jours, startDate - 7 jours)`

---

### E06-006 — Relance de demande expirée ⬜ A faire
**Priorité** : P2 | **Taille** : S

- Bouton "Relancer" sur une demande `expired` dans "Mes demandes"
- Ouvre le modal pré-rempli avec les mêmes infos (cinéma, salle, dates, nb visionnages)
- Confirmation requise avant soumission
- Crée une nouvelle demande (ne modifie pas l'ancienne)

---

### E06-007 — Historique des commandes ⬜ A faire
**Priorité** : P1 | **Taille** : M

**Fichier cible** : `src/app/[locale]/(app)/orders/page.tsx` (actuellement un stub)

**À implémenter** :
- Liste de toutes les réservations payées (table `orders` + `orderItems` joins `films`, `cinemas`)
- Colonnes : Film, Ayant droit, Cinéma/Salle, Dates, Montant, Statut commande, Statut livraison DCP/KDM
- Filtres : cinéma, période, statut
- Lien "Télécharger la facture" → URL Stripe Invoice (`stripeInvoiceId`)
- Statuts de livraison : `pending`, `in_progress`, `delivered` (champ `deliveryStatus` sur `orderItems`)

**Clés i18n existantes** : `orders.title`, `orders.columns.*`, `orders.downloadInvoice`, `orders.deliveryStatus.*`

---

## Récapitulatif du statut

| Ticket | Description | Statut | Priorité |
|--------|-------------|--------|----------|
| E06-001 | Modal d'ajout (panier ou demande) | ✅ Done | P0 |
| E06-002 | Panier exploitant | ⬜ A faire | P0 |
| E06-003 | Validation du panier et paiement | ⬜ A faire | P0 |
| E06-004 | Espace "Mes demandes" | ⬜ A faire | P0 |
| E06-005 | Expiration automatique des demandes | ⬜ A faire | P0 |
| E06-006 | Relance de demande expirée | ⬜ A faire | P2 |
| E06-007 | Historique des commandes | ⬜ A faire | P1 |

**Prochaine priorité** : E06-002 (Panier exploitant) + E06-004 (Mes demandes) — les deux pages UI principales qui débloquent le flow complet.
