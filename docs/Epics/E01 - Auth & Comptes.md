# E01 — Authentification & Gestion des comptes

**Phase** : P0
**Librairie** : Better Auth (self-hosted)

---

## Contexte

Deux types de comptes distincts : **Exploitant** et **Ayant droit**. Chaque compte peut avoir plusieurs utilisateurs avec des niveaux de permissions différents. **Un utilisateur peut aussi être membre de plusieurs comptes** (ex : invité dans un second compte) — il faut un mécanisme de sélection du compte actif.

Règle métier clé : les ayants droits ne peuvent pas s'inscrire eux-mêmes — ils sont créés par les admins dans le backoffice.

Principe d'architecture : les pages de **gestion du compte** (informations, membres, cinémas) et le **profil utilisateur** restent dans chaque groupe de routes (pour garder le layout contextuel) mais partagent des **composants communs** (`src/components/account/`, `src/components/profile/`).

---

## Tickets

### E01-001 — Inscription exploitant ✅ Done
**Priorité** : P0 | **Taille** : M

- ✅ Formulaire : email, mot de passe, nom
- ✅ Validation email (lien de confirmation via Resend HTTP API)
- ✅ Création du compte exploitant associé (onboarding flow — `(app)/onboarding/`)
- ✅ Redirection vers l'onboarding si pas de compte lié (`[locale]/page.tsx`)

---

### E01-002 — Connexion email + mot de passe ✅ Done
**Priorité** : P0 | **Taille** : S

- ✅ Page de connexion
- ✅ Gestion des erreurs (email inconnu, mdp incorrect, email non vérifié)
- ✅ Lien "Renvoyer l'email de vérification" affiché sur la page login si `emailNotVerified`
- ✅ Session persistante (cookie Better Auth)
- ✅ Redirection post-login selon le type de compte (exploitant → catalogue, ayant droit → films, admin → dashboard)

---

### E01-003 — MFA (TOTP) ✅ Done (base)
**Priorité** : P1 | **Taille** : M

- ✅ Support TOTP dans le flow de login (saisie du code 6 chiffres)
- ✅ Plugin twoFactor configuré (Better Auth server + client)
- ➡️ Activation UI, codes de récupération, forced MFA → déplacés vers **E-Security**

---

### E01-004 — Mot de passe oublié / reset ✅ Done
**Priorité** : P0 | **Taille** : S

- ✅ Formulaire "mot de passe oublié" → email avec lien tokenisé
- ✅ Page de réinitialisation (avec règles mdp + confirmation)
- ✅ Invalidation des sessions existantes après reset (`revokeSessionsOnPasswordReset: true`)

---

### E01-005 — Invitation de membres au sein d'un compte ✅ Done
**Priorité** : P0 | **Taille** : M

- ✅ Invitation par email avec token (expiration 7 jours)
- ✅ Formulaire d'invitation sur la page membres (email + rôle)
- ✅ Page d'acceptation d'invitation (`(app)/accept-invitation/`)
- ✅ Liste des invitations en attente avec annulation
- ✅ Contrôle de permissions (owner/admin) pour inviter
- ✅ Email d'invitation via Resend HTTP API (`sendInvitationEmail`)

---

### E01-006 — Gestion des rôles et permissions ✅ Done
**Priorité** : P0 | **Taille** : M

- ✅ Interface de gestion des membres : liste des membres avec rôle
- ✅ Modification du rôle (promote admin / demote member) — owner only
- ✅ Révocation d'accès (remove member)
- ✅ Contrôle RBAC dans les server actions (owner vs admin vs member)

**Rôles pour un compte Exploitant** :
- `owner` : accès total, peut gérer les membres et supprimer le compte
- `admin` : peut gérer les membres, passer des commandes, accéder aux factures
- `member` : peut parcourir le catalogue et ajouter au panier, ne peut pas payer

**Rôles pour un compte Ayant Droit** :
- `owner` : accès total
- `admin` : peut gérer catalogue, valider les demandes, voir le wallet
- `member` : lecture seule

---

### E01-007 — Profil utilisateur ✅ Done
**Priorité** : P1 | **Taille** : S

- ✅ Nom (modification)
- ✅ Email (affiché, en lecture seule avec hint re-confirmation)
- ✅ Changement de mot de passe (current + new + confirm)
- ⬜ Activation/désactivation MFA (dépend de E01-003)
- ✅ Langue (FR / EN) — sélecteur avec Select dropdown dans la page profil + language switcher dans le layout auth
- ✅ Migration vers composants partagés + route `/profile` dans chaque contexte (voir E01-011)

---

### E01-008 — Déconnexion & gestion des sessions ✅ Done
**Priorité** : P0 | **Taille** : S

- ✅ Déconnexion manuelle (bouton sign-out sur les pages auth + page profil)
- ✅ `signOutAndCleanup()` centralisé dans `src/lib/auth/client.ts` — supprime le cookie `active_account_id` + appelle `authClient.signOut()` + redirige vers `/`. Utilisé par marketplace-header, nav-user, already-connected, sessions-list.
- ✅ Liste des sessions actives (device, IP, date)
- ✅ Révocation individuelle de session
- ✅ Révocation de toutes les autres sessions
- ✅ Expiration automatique des sessions (30 jours, refresh 24h — configuré dans Better Auth)

---

### E01-009 — Compte actif & multi-comptes ✅ Done
**Priorité** : P0 | **Taille** : L

Un utilisateur peut être membre de plusieurs comptes (via invitations). Aujourd'hui `getCurrentMembership()` fait un `findFirst` non-déterministe — il faut un vrai mécanisme de sélection du compte actif.

**Problèmes actuels** :
- Aucune notion de "compte actif" (pas de cookie, pas de context)
- `findFirst` sans tri → le compte résolu est aléatoire si l'utilisateur a plusieurs memberships
- `getCurrentMembership()` est dupliquée dans `actions.ts` et `invitation-actions.ts`
- Le middleware ne vérifie pas le type de compte → un exploitant peut naviguer vers `/films` (routes ayant droit)

**Décisions** :
- **Multi-type** : l'architecture permet qu'un user soit dans des comptes de types différents (exploitant + ayant droit), mais on ne construit pas l'UI de switch cross-type pour l'instant.
- **AccountProvider (React Context)** : `src/components/providers/account-provider.tsx` — contexte React avec `useAccountContext()` hook. Les layouts serveur fetchent les memberships et les passent au provider, qui les expose à tous les composants enfants (header, sidebar, switcher). Le provider est monté avec `key={activeCookie?.accountId ?? "no-account"}` pour forcer le remount au switch de compte.
- **Cookie non-HttpOnly** : `active_account_id` est un cookie standard (pas HttpOnly) — nécessaire pour le nettoyage côté client dans `signOutAndCleanup()`. Le switch passe par une server action `switchAccount()`.
- **Cookie encodé** : le cookie contient `accountId:type` (ex: `abc-123:exhibitor`) pour que le proxy puisse vérifier le type sans DB call.
- **Switcher = dropdown** : composant intégré au header marketplace / sidebar dashboard — pas de page dédiée. Masqué si l'user n'a qu'un seul compte.
- **Guard = proxy.ts** : vérification du type de compte vs route group au niveau proxy (edge), avant le rendering.
- **Guards page-level** : la page `/accounts` redirige vers `/no-account` si `memberships.length === 0` (guard côté serveur, car proxy.ts n'a pas accès à la DB). La page racine `[locale]/page.tsx` redirige vers `/no-account` si 0 membership, `/accounts` si 1+.
- **User sans compte** : page `/no-account` — message explicatif + bouton créer un compte + section invitations en attente.
- **Invitations en attente** : composant `PendingInvitations` affiché sur `/no-account` et `/accounts`. Sur `/no-account`, après acceptation → redirect vers `/accounts` (via prop `redirectAfterAccept`). Sur `/accounts` → `router.refresh()` pour mettre à jour la liste.
- **Acceptation invitation** : switch automatique vers le nouveau compte après acceptation.
- **Member et switcher** : un `member` peut switcher de compte via le dropdown, il ne peut juste pas accéder aux pages `/account/*` (gestion).
- **Helper centralisé** : `getCurrentMembership()` et `switchAccount()` dans `src/lib/auth/membership.ts`.
- **Cookie invalide** : si le cookie référence un compte dont le user n'est plus membre → auto-nettoyage du cookie + redirect vers la page racine (qui réévalue les memberships).
- **Toast après switch** : afficher un toast «Vous êtes maintenant sur [nom du compte]» après un switch.
- **Page sans compte** : dans le route group `(auth)` (layout centré, même style que login/register).
- **Compte actif cliquable** : sur la page `/accounts`, le bouton du compte actif est cliquable — appelle `switchAccount()` qui redirige vers l'accueil correspondant.
- **signOutAndCleanup()** : helper centralisé dans `src/lib/auth/client.ts` — supprime le cookie `active_account_id` côté client + appelle `authClient.signOut()` + redirige vers `/`. Tous les points de déconnexion utilisent ce helper.

**Tâches** :
- ✅ Créer `src/lib/auth/membership.ts` avec les helpers centralisés : `getCurrentMembership()`, `switchAccount()`, `getAllMemberships()` — supprimer les doublons dans actions.ts / invitation-actions.ts
- ✅ Stocker le `accountId:type` actif dans un cookie HttpOnly (`active_account_id`) — mis à jour au login et au switch via server action
- ✅ Au login / sur la page racine (`[locale]/page.tsx`) : si 1 seul compte → auto-sélection + set cookie ; si plusieurs → afficher un sélecteur de compte
- ✅ Composant `AccountSwitcher` (dropdown) dans le header marketplace et dans la sidebar dashboard — reçoit les memberships en props depuis le layout serveur — masqué si un seul compte
- ✅ Au switch de compte : server action `switchAccount()` → met à jour le cookie + redirige vers l'interface correspondante (exploitant → `/catalogue`, ayant droit → `/films`, admin → `/dashboard`)
- ✅ Guard middleware : lire le cookie `active_account_id`, extraire le type, vérifier la correspondance avec le route group — rediriger si mismatch
- ✅ Auto-nettoyage : si le cookie référence un compte invalide (user retiré) → supprimer le cookie + redirect vers `/`
- ✅ Acceptation d'invitation : après `acceptInvitation()`, switch automatique vers le nouveau compte (appel `switchAccount()`)
- ✅ Page "sans compte" : si user authentifié sans aucun membership → page dédiée avec message explicatif + actions (créer un compte / contacter admin)
- ✅ Page `/accounts` (route group `(auth)`) : liste tous les comptes de l'utilisateur avec switch + formulaire de création d'un nouveau compte exploitant (companyName + country). Lien "Mes comptes" ajouté dans le menu user du header marketplace et dans le dropdown sidebar. L'onboarding reste one-shot (première inscription uniquement).
- ✅ Guard page `/accounts` : redirige vers `/no-account` si `memberships.length === 0` (guard côté serveur)
- ✅ Composant `PendingInvitations` (`src/components/account/pending-invitations.tsx`) : affiché sur `/no-account` et `/accounts`, prop `redirectAfterAccept` pour contrôler la navigation post-acceptation
- ✅ Server actions `getMyPendingInvitations()` et `acceptInvitationById()` dans les actions du compte
- ✅ Relation Drizzle `invitationsRelations` ajoutée au schéma (pas de migration nécessaire)
- ✅ Migration `middleware.ts` → `proxy.ts` (Next.js 16 — codemod officiel `middleware-to-proxy`)

---

### E01-010 — Gestion du compte (pages contextuelles + composants partagés) ✅ Done
**Priorité** : P0 | **Taille** : L

Les pages de gestion d'un compte (informations, membres, invitations) restent **dans chaque groupe de routes** (`(app)`, `(rights-holder)`, `(admin)`) pour que l'utilisateur ne quitte jamais son contexte visuel. La logique et les composants sont **partagés** via `src/components/account/`.

**Problèmes actuels** :
- Pages members existantes uniquement dans `(app)/account/` — vides côté `(rights-holder)`
- Pas de page d'édition des informations du compte (nom société, adresse, TVA…)
- Les pages cinémas sont dans `(app)/account/cinemas/` (placeholder)

**Décisions** :
- **Pas de route group `(account)` dédié** — chaque interface garde ses pages `/account/*` dans son propre layout (marketplace, dashboard sidebar, admin sidebar).
- Les comptes **admin** sont un cas à part — la gestion admin se fait via le backoffice `(admin)`, pas via `/account/`.
- Le compte est résolu via le cookie `active_account_id` (cf. E01-009), pas via l'URL.
- **Tabs horizontaux** : sous-navigation `Informations | Membres | Cinémas` (composant partagé). Le tab Cinémas est masqué si le compte n'est pas exploitant.
- **Formulaire unique** : page informations = un seul formulaire avec tous les champs + bouton Sauvegarder.
- **TVA** : vérification automatique du numéro de TVA via API VIES (UE) à la saisie.
- **Redirect `/account`** : la route `/account` redirige vers `/account/informations`.
- **Suppression de compte** : pas de self-delete — uniquement via admin backoffice.
- **Split actions** : server actions gestion compte dans `src/components/account/actions.ts` — helpers membership/switch dans `src/lib/auth/membership.ts`.
- **Route group `(account)`** : dédié à toutes les pages `/account/*` (management + profil). Layout standalone avec header minimal (lien retour dynamique selon le type de compte). Évite le conflit de routes parallèles entre `(app)` et `(rights-holder)`.
- **Route group `(management)`** : imbriqué dans `(account)/account/` pour isoler le layout avec tabs (heading + AccountTabs). Le profil reste hors de ce groupe.

**Architecture implémentée** :

```
src/components/account/                     ← composants partagés
├── account-info-form.tsx                   ← formulaire informations (companyName, address, TVA…)
├── account-tabs.tsx                        ← sous-navigation horizontale (Informations | Membres | Cinémas)
├── members-list.tsx                        ← liste des membres + gestion rôles (refacto)
├── invite-section.tsx                      ← invitations (refacto)
└── actions.ts                              ← server actions centralisées (getAccountInfo, updateAccountInfo, getMembers, updateMemberRole, removeMember, inviteMember, getPendingInvitations, cancelInvitation, acceptInvitation)

src/app/[locale]/(account)/
├── layout.tsx                              ← layout standalone (auth guard + header minimal avec lien retour)
└── account/
    ├── (management)/
    │   ├── layout.tsx                      ← RBAC guard (owner/admin) + heading + AccountTabs
    │   ├── page.tsx                        ← redirect vers /account/informations
    │   ├── informations/page.tsx           ← <AccountInfoForm />
    │   ├── members/page.tsx               ← <MembersList /> + <InviteSection />
    │   └── cinemas/page.tsx               ← placeholder (exploitant uniquement)
    └── profile/
        ├── page.tsx                        ← <ProfileForm />
        ├── actions.ts                      ← server actions profil (updateProfile, changePassword, sessions)
        └── profile-form.tsx               ← formulaire profil (client component)
```

Le route group `(account)` est **séparé** de `(app)` et `(rights-holder)` pour éviter les conflits de routes parallèles Next.js. Le layout adapte le lien retour selon le type de compte actif (catalogue, films, dashboard).

**Tâches** :
- ✅ Créer `src/components/account/` avec les composants partagés : `AccountInfoForm`, `AccountTabs`, `MembersList`, `InviteSection`
- ✅ Refactorer les composants existants (`members-list.tsx`, `invite-section.tsx`) depuis `(app)/account/members/` → `src/components/account/` — les rendre indépendants du layout
- ✅ Centraliser les server actions (getAccountInfo, updateAccountInfo, getMembers, updateMemberRole, removeMember, inviteMember, cancelInvitation, acceptInvitation) dans `src/components/account/actions.ts` — anciens fichiers supprimés
- ✅ Page informations du compte (`/account/informations`) dans `(app)` et `(rights-holder)` : affichage et édition de companyName, address, city, postalCode, country, vatNumber
- ✅ Implémenter les pages `/account/informations` et `/account/members` dans `(rights-holder)`
- ✅ RBAC : seuls les rôles `owner` et `admin` peuvent accéder aux pages `/account/*` — les `member` sont redirigés (via layout serveur)
- ✅ Lien "Gérer le compte" dans le header marketplace (menu user) et dans la sidebar dashboard — visible uniquement pour owner/admin
- ✅ Traductions (en/fr) : namespace `accountSettings` + clé `navigation.manageAccount`

---

### E01-011 — Profil utilisateur (dans chaque contexte) ✅ Done
**Priorité** : P0 | **Taille** : M

La page profil concerne l'**utilisateur** (pas le compte). Elle est dans `(account)/account/profile/` — accessible depuis tous les contextes via le layout standalone. Les composants sont extraits dans `src/components/profile/` pour la modularité.

**Architecture implémentée** :

```
src/components/profile/                     ← composants partagés
├── actions.ts                              ← server actions (updateProfile, changePassword, listSessions, revokeSession, revokeAllOtherSessions)
├── profile-info-form.tsx                   ← nom, email (readonly)
├── change-password-form.tsx                ← changement de mot de passe (current + new + confirm)
├── sessions-list.tsx                       ← sessions actives + révocation individuelle/globale + sign out
├── language-selector.tsx                   ← sélecteur de langue (FR / EN) avec Select dropdown
└── profile-tabs.tsx                        ← sous-navigation Profil | Sessions

src/app/[locale]/(account)/account/profile/
├── layout.tsx                              ← heading + ProfileTabs
├── page.tsx                                ← ProfileInfoForm + ChangePasswordForm + LanguageSelector
└── sessions/page.tsx                       ← SessionsList
```

**Décisions** :
- **Tabs** : sous-navigation `Profil | Sessions` (cohérent avec les tabs de `/account/*`).
- **Route** : reste à `/account/profile` (déplacement vers `/profile` reporté — pas prioritaire).
- **Langue** : sélecteur avec `Select` dropdown dans un Card, utilise `next-intl` router.replace pour switcher la locale.

**Tâches** :
- ✅ Extraire `src/components/profile/` avec les composants partagés : `ProfileInfoForm`, `ChangePasswordForm`, `SessionsList`, `LanguageSelector`, `ProfileTabs`
- ✅ Refactorer `profile-form.tsx` monolithique (~280 lignes) → composants séparés + server actions dans `src/components/profile/actions.ts`
- ✅ Sous-navigation par tabs `Profil | Sessions` avec layout dédié
- ✅ Sélecteur de langue préférée (FR / EN) avec Select dropdown
- ✅ Liens "Mon profil" fonctionnels (marketplace header, sidebar RH, sidebar admin)
- ✅ Traductions en/fr mises à jour (tabs, language, titleDescription)
- ⬜ Éventuellement déplacer la route de `/account/profile` à `/profile` (reporté)
- ➡️ Activation/désactivation MFA depuis la page profil → déplacé vers **E-Security**

---

## Tests — Couverture E01

### Tests unitaires (Vitest) — 96 tests ✅

| Fichier | Tests | Couverture |
|---------|-------|------------|
| `src/lib/auth/__tests__/active-account-cookie.test.ts` | 16 | `parseActiveAccountCookie`, `encodeActiveAccountCookie`, `getHomePathForType`, roundtrip, edge cases |
| `src/lib/auth/__tests__/proxy-helpers.test.ts` | 50 | `stripLocale`, `extractLocale`, `isPublicAuthPath`, `isAccountOptionalPath`, `isUnprotectedApiPath`, `getRequiredAccountType` — tous types de chemins |
| `src/lib/pricing/__tests__/pricing.test.ts` | 19 | `calculatePricing` (marges, commissions, frais, arrondis), `resolveCommissionRate`, `formatAmount` |
| `src/lib/__tests__/utils.test.ts` | 11 | `calculateRequestExpiry`, `isRequestExpired`, `findPriceForCountry` |

### Tests E2E (Playwright) — 29 tests ✅

| Fichier | Tests | Couverture |
|---------|-------|------------|
| `e2e/auth.spec.ts` | 16 | Pages auth (login/register/forgot-password), redirections auth, gestion des locales, validation formulaire login, mismatch mot de passe register |
| `e2e/account.spec.ts` | 8 | Redirections compte non authentifié, API auth accessible, protection des routes par type de compte (exhibitor/RH/admin) |
| `e2e/user-flows.spec.ts` | 5 | Inscription + vérification email, onboarding (no-account → onboarding → catalogue), édition infos account (company name persist), édition profil (name + toast), page sessions (heading + revoke buttons) |

### Infrastructure test

- **Vitest** : `vitest.config.ts`, `vitest.setup.ts` (jest-dom matchers)
- **Playwright** : `playwright.config.ts` (chromium, 1 worker séquentiel, webServer auto-start)
- **Extraction `proxy-helpers.ts`** : toutes les fonctions pures extraites de `proxy.ts` pour testabilité
