# E03 — Comptes Ayants Droits

**Phase** : P0
**Statut** : ✅ Done

---

## Contexte

Les ayants droits (distributeurs, archives, producteurs…) sont les vendeurs de la marketplace. Ils ne peuvent pas s'inscrire eux-mêmes : leur compte est **créé directement en base de données** par l'équipe TIMELESS (phase prototype). L'admin invite ensuite des utilisateurs via le système d'invitation existant (commun à tous les types de compte).

> La création via backoffice admin sera implémentée dans **E11** (P3).

---

## Modèle de données

```
Compte Ayant Droit
  └── Utilisateurs (avec rôles : owner / admin / member)
  └── Catalogue de films (E04)
  └── Wallet Stripe Connect (E08)
  └── Taux de commission (configuré en DB, non visible par l'ayant droit — **0 % par défaut** depuis mars 2026, modèle marge uniquement)
```

---

## Dépendances

- **E08** — Le flow de paiement, splits et TVA. E03 implémente la configuration Stripe Connect ; E08 consomme le `stripeConnectAccountId` pour les virements.
- **E11** — Backoffice admin : création et gestion des comptes rights_holder via UI.

---

## Hors scope E03

- Création du compte rights_holder via UI admin (→ E11, fait en DB pour l'instant)
- Édition du taux de commission via UI (→ E11, fait en DB pour l'instant — défaut 0 %)
- Suspension / désactivation d'un compte rights_holder (→ E11)
- Flow de paiement et splits (→ E08)
- Wallet et historique des transactions (→ E09)
- Dashboard avec données réelles (→ après E04, E07, E08)

---

## Tickets

---

### E03-001 — Page de compte & configuration Stripe Connect (interface ayant droit)
**Priorité** : P0 | **Taille** : L

#### Description
Adapter l'interface de gestion du compte (`/account/information`) pour les ayants droits, et implémenter le flow complet de configuration Stripe Connect.

#### Formulaire profil (onglet "Informations")
Même composant que les exhibitors, avec adaptations :

| Champ | Exhibitor | Rights holder |
|-------|-----------|---------------|
| Raison sociale | ✅ | ✅ |
| Pays | ✅ | ✅ |
| Numéro de TVA | ✅ | ✅ |
| Adresse / ville / code postal | ✅ | ✅ |
| Email de contact | ✅ | ✅ |
| Téléphone | ✅ | ✅ |
| Devise préférée | ✅ | ✅ |
| Type de cinéma | ✅ | ❌ |
| Onglet "Cinémas" | ✅ | ❌ |
| Onglet "Stripe Connect" | ❌ | ✅ (owner/admin) |
| Onglet "API" | ✅ | ✅ |

#### Onglet "Stripe Connect" (owner / admin uniquement)

**État 1 — Non configuré :**
- Message : *"Configurez votre compte de paiement pour recevoir les revenus de vos films."*
- Bouton CTA : "Configurer le paiement"

**État 2 — Configuré :**
- Badge "Compte de paiement actif"
- Lien vers le dashboard Stripe Express du client (via `stripe.accounts.createLoginLink(stripeConnectAccountId)`)

#### Flow Stripe Connect Express (implémentation complète)

1. **Clic sur "Configurer le paiement"** → server action :
   - Si aucun `stripeConnectAccountId` en base : créer un compte Connect Express via `stripe.accounts.create({ type: "express", email: contactEmail })`
   - Stocker le `stripeConnectAccountId` en base
   - Si un `stripeConnectAccountId` existe déjà (onboarding précédemment abandonné) : réutiliser ce compte
   - Dans tous les cas : générer un nouveau lien via `stripe.accountLinks.create({ type: "account_onboarding", return_url, refresh_url })`
   - Rediriger vers le lien Stripe (hosted, KYC géré par Stripe)

2. **Retour depuis Stripe** (`return_url` → `/account/information?tab=stripe-connect`) :
   - Vérifier `details_submitted` via `stripe.accounts.retrieve(stripeConnectAccountId)`
   - Si `false` : afficher un message "Configuration incomplète, veuillez recommencer" + réafficher le CTA

3. **Lien expiré** (`refresh_url` → `/account/stripe-connect/refresh`) :
   - Régénérer un nouveau lien d'onboarding et rediriger automatiquement

4. **Webhook `account.updated`** (compléter le TODO dans `/api/webhooks/stripe/route.ts`) :
   - Si `details_submitted && charges_enabled` → `stripeConnectOnboardingComplete = true` en base
   - Lookup du compte via `stripeConnectAccountId`

#### Bannière Stripe Connect
Affichée sur **toutes les pages** de l'interface ayant droit tant que `stripeConnectOnboardingComplete = false` :

- **Texte** : *"Votre compte de paiement n'est pas encore configuré — les achats de vos films sont bloqués."*
- **Non-dismissable**
- Visible pour **tous les rôles** (owner, admin, member)
- Cliquable (→ `/account/information?tab=stripe-connect`) **uniquement pour owner et admin**
- Pour les membres : bannière visible mais non cliquable
- Disparaît après `revalidatePath` déclenché par le webhook (pas de temps réel — un reload suffit)

#### Critères d'acceptation
- [x] Le formulaire profil rights_holder n'affiche pas "type de cinéma" ni l'onglet "Cinémas"
- [x] L'onglet "Stripe Connect" est visible pour owner/admin, absent pour les membres
- [x] L'onglet "API" est disponible pour les rights_holders
- [x] Clic sur "Configurer le paiement" → crée le compte Express (ou réutilise l'existant) et redirige vers Stripe
- [x] Retour depuis Stripe → vérification `details_submitted` et affichage de l'état correct
- [x] Si onboarding abandonné et repris → le même compte Stripe est réutilisé (pas de doublon)
- [x] Le webhook `account.updated` met à jour `stripeConnectOnboardingComplete` en base
- [x] La bannière s'affiche sur toutes les pages si `stripeConnectOnboardingComplete = false`
- [x] La bannière est cliquable pour owner/admin, non cliquable pour les membres

---

### E03-002 — Dashboard ayant droit (placeholder)
**Priorité** : P1 | **Taille** : XS

#### Description
La page `/home` est la home des ayants droits (même pattern que les exhibitors avec `/home` séparé de `/catalog`).
`/films` est réservé au catalogue de films (E04).
Pour l'instant, placeholder vide avec empty state.
Les données réelles seront ajoutées dans les épics suivants (E04, E07, E09).

**Impact sur le routing :**
- Ajouter `/home` dans `RIGHTS_HOLDER_PATHS` (`proxy-helpers.ts`)
- `getHomePathForType("rights_holder")` → `/home` (au lieu de `/films`)
- La sidebar rights_holder pointe vers `/home` en premier item

#### Données prévues à terme
- Demandes de validation en attente — deadline = 7 jours avant la date de projection
- Dernières transactions
- Solde wallet (disponible / en attente)

#### Critères d'acceptation
- [x] La page `/home` s'affiche sans erreur pour un compte rights_holder
- [x] Un empty state est affiché (pas de page blanche)
- [x] Après login, un rights_holder est redirigé vers `/home` (pas `/films`)

---

### E03-003 — Gestion des membres (vérification)
**Priorité** : P1 | **Taille** : XS

#### Description
Le système d'invitation et de gestion des membres est déjà implémenté et commun à tous les types de compte. Il s'agit uniquement de vérifier que ça fonctionne pour les comptes rights_holder.

Fonctionnalités disponibles via `/account/information` → onglet "Membres" (owner / admin) :
- Liste des membres avec rôles (owner / admin / member)
- Invitation par email
- Modification de rôle / révocation

#### Critères d'acceptation
- [x] Un owner/admin rights_holder peut inviter un utilisateur
- [x] L'utilisateur invité reçoit un email et peut rejoindre le compte
- [x] La modification de rôle et la révocation fonctionnent

---

---

## Tests

### Tests unitaires (Vitest) ✅

**`src/lib/auth/__tests__/proxy-helpers.test.ts`** — mis à jour :
- `getRequiredAccountType("/en/home")` → `null` (path partagé exhibitor/RH)
- `getRequiredAccountType("/en/home/sub-page")` → `null`
- `getRequiredAccountType("/en/films")` → `"rights_holder"`
- `getHomePathForType("rights_holder")` → `"/home"`

> Note : `/home` est un path partagé (pas dans EXHIBITOR_PATHS ni RIGHTS_HOLDER_PATHS) car les deux types de compte y accèdent. La différenciation se fait dans le layout `(home)/layout.tsx` qui rend le bon shell selon le type de compte.

**`src/lib/auth/__tests__/active-account-cookie.test.ts`** — mis à jour :
- `getHomePathForType("rights_holder")` → `"/home"` (était `"/films"`)

**`src/lib/services/__tests__/rights-holder-service.test.ts`** — créé (4 tests) :
- `isStripeConnectComplete({ details_submitted: true, charges_enabled: true })` → `true`
- `isStripeConnectComplete({ details_submitted: true, charges_enabled: false })` → `false`
- `isStripeConnectComplete({ details_submitted: false, charges_enabled: false })` → `false`
- `isStripeConnectComplete({ details_submitted: false, charges_enabled: true })` → `false`

---

### Tests E2E (Playwright)

> Note : le flow Stripe externe (navigation sur stripe.com, KYC) n'est pas testable en E2E. Les états avant/après sont testés via seed DB.

**`e2e/rights-holder-routing.spec.ts`**
- Après login avec un compte `rights_holder` → redirection vers `/[locale]/home`
- `/home` s'affiche sans erreur (empty state visible)
- `/films`, `/validation-requests`, `/wallet` s'affichent sans erreur
- Un rights_holder accédant à `/catalog` → redirigé vers `/home`

**`e2e/rights-holder-account.spec.ts`**
- Le formulaire profil ne contient pas le champ "type de cinéma"
- L'onglet "Cinémas" n'est pas visible
- L'onglet "Stripe Connect" est visible pour owner/admin, absent pour member
- L'onglet "API" est visible pour owner/admin
- Un owner/admin peut mettre à jour les informations du profil (raison sociale, pays…)

**`e2e/rights-holder-stripe-connect.spec.ts`**
- Quand `stripeConnectOnboardingComplete = false` (seed) → bannière visible sur toutes les pages
- Bannière cliquable (→ `/account/information?tab=stripe-connect`) pour owner/admin
- Bannière non cliquable (pas de `<a>`) pour un member
- Onglet Stripe Connect état 1 : bouton "Configurer le paiement" visible
- Quand `stripeConnectOnboardingComplete = true` (seed) → bannière absente, badge "Compte de paiement actif" visible
- Clic sur "Configurer le paiement" → déclenche le server action (vérifié via network request)

---

## Points ouverts

*Aucun point ouvert.*

---

## Implémentation

### Fichiers créés

| Fichier | Description |
|---------|-------------|
| `src/lib/services/rights-holder-service.ts` | Fonction pure `isStripeConnectComplete()` |
| `src/lib/services/__tests__/rights-holder-service.test.ts` | Tests unitaires (4 tests) |
| `src/components/account/stripe-connect-actions.ts` | Server actions : `startStripeConnectOnboarding`, `checkStripeConnectStatus`, `createStripeConnectDashboardLink` |
| `src/components/account/stripe-connect-tab.tsx` | Composant client — onglet Stripe Connect (3 états) |
| `src/components/shared/stripe-connect-banner.tsx` | Bannière non-dismissable (server component) |
| `src/app/[locale]/(account)/account/(management)/stripe-connect/page.tsx` | Page onglet Stripe Connect |
| `src/app/[locale]/(account)/account/stripe-connect/refresh/page.tsx` | Page de refresh (régénère le lien Stripe) |
| `src/app/[locale]/(home)/layout.tsx` | Layout conditionnel : marketplace header (exhibitor) ou sidebar (RH) |
| `src/app/[locale]/(home)/home/page.tsx` | Dashboard unifié (affichage conditionnel par type de compte) |

### Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `src/lib/auth/proxy-helpers.ts` | `/home` retiré de `EXHIBITOR_PATHS` (devient path partagé) |
| `src/lib/auth/active-account-cookie.ts` | `getHomePathForType("rights_holder")` → `"/home"` |
| `src/app/[locale]/(rights-holder)/layout.tsx` | Ajout lien `/home` en premier item sidebar + `StripeConnectBanner` |
| `src/app/[locale]/(account)/layout.tsx` | Back href RH : `/films` → `/home` |
| `src/app/[locale]/(account)/account/(management)/layout.tsx` | Ajout `showStripeConnect={isRightsHolder}` sur `AccountTabs` |
| `src/components/account/account-tabs.tsx` | Nouveau prop `showStripeConnect` |
| `src/app/api/webhooks/stripe/route.ts` | Webhook `account.updated` complété (DB update + `revalidatePath`) |
| `messages/en.json` | Ajout `stripeConnect`, `rightsHolderDashboard`, `navigation.home`, `accountSettings.tabs.stripeConnect` |
| `messages/fr.json` | Idem en français |
| `src/lib/auth/__tests__/proxy-helpers.test.ts` | `/home` → `null` (shared path) |
| `src/lib/auth/__tests__/active-account-cookie.test.ts` | RH home → `/home` |

### Fichiers supprimés

| Fichier | Raison |
|---------|--------|
| `src/app/[locale]/(app)/home/page.tsx` | Déplacé vers `(home)/home/page.tsx` (route group dédiée) |

### Décision d'architecture : `/home` comme path partagé

Le spec initial prévoyait `/home` dans `RIGHTS_HOLDER_PATHS`. Cependant, les exhibitors utilisent aussi `/home` (lien dans la marketplace header). Pour éviter de bloquer un type de compte :

- `/home` n'est dans **aucune** liste de paths typés → `getRequiredAccountType("/home")` retourne `null`
- La route group `(home)` a son propre `layout.tsx` qui détecte le type de compte et rend le bon shell
- Les pages sous `(rights-holder)/` (films, validation-requests, wallet) conservent le sidebar layout existant
- La bannière Stripe Connect est affichée dans les deux layouts (RH sidebar + home layout)
