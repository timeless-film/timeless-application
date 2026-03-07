# E01 — Authentification & Gestion des comptes

**Phase** : P0
**Librairie** : Better Auth (self-hosted)

---

## Contexte

Deux types de comptes distincts : **Exploitant** et **Ayant droit**. Chaque compte peut avoir plusieurs utilisateurs avec des niveaux de permissions différents.

Règle métier clé : les ayants droits ne peuvent pas s'inscrire eux-mêmes — ils sont créés par les admins dans le backoffice.

---

## Tickets

### E01-001 — Inscription exploitant ✅ Done
**Priorité** : P0 | **Taille** : M

- ✅ Formulaire : email, mot de passe, nom
- ✅ Validation email (lien de confirmation — lien affiché en console, Customer.io pas encore branché)
- ✅ Création du compte exploitant associé (onboarding flow — `(app)/onboarding/`)
- ✅ Redirection vers l'onboarding si pas de compte lié (`[locale]/page.tsx`)

---

### E01-002 — Connexion email + mot de passe ✅ Done
**Priorité** : P0 | **Taille** : S

- ✅ Page de connexion
- ✅ Gestion des erreurs (email inconnu, mdp incorrect, email non vérifié)
- ✅ Session persistante (cookie Better Auth)
- ✅ Redirection post-login selon le type de compte (exploitant → catalogue, ayant droit → films, admin → dashboard)

---

### E01-003 — MFA (TOTP) 🔄 En cours
**Priorité** : P1 | **Taille** : M

- ✅ Support TOTP dans le flow de login (saisie du code 6 chiffres)
- ✅ Plugin twoFactor configuré (Better Auth server + client)
- ⬜ Activation optionnelle depuis les paramètres du compte (UI)
- ⬜ Codes de récupération générés à l'activation
- ⬜ Forced MFA possible pour les admins

---

### E01-004 — Mot de passe oublié / reset ✅ Done
**Priorité** : P0 | **Taille** : S

- ✅ Formulaire "mot de passe oublié" → email avec lien tokenisé
- ✅ Page de réinitialisation (avec règles mdp + confirmation)
- ⬜ Invalidation des sessions existantes après reset

---

### E01-005 — Invitation de membres au sein d'un compte ✅ Done
**Priorité** : P0 | **Taille** : M

- ✅ Invitation par email avec token (expiration 7 jours)
- ✅ Formulaire d'invitation sur la page membres (email + rôle)
- ✅ Page d'acceptation d'invitation (`(app)/accept-invitation/`)
- ✅ Liste des invitations en attente avec annulation
- ✅ Contrôle de permissions (owner/admin) pour inviter
- ⬜ Email d'invitation via Customer.io (actuellement console.warn)

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
- ⬜ Langue (FR / EN) — le language switcher existe dans le layout auth

---

### E01-008 — Déconnexion & gestion des sessions ✅ Done
**Priorité** : P0 | **Taille** : S

- ✅ Déconnexion manuelle (bouton sign-out sur les pages auth + page profil)
- ✅ Liste des sessions actives (device, IP, date)
- ✅ Révocation individuelle de session
- ✅ Révocation de toutes les autres sessions
- ✅ Expiration automatique des sessions (30 jours, refresh 24h — configuré dans Better Auth)
