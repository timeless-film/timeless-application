# E01 — Authentification & Gestion des comptes

**Phase** : P0
**Librairie** : Better Auth (self-hosted)

---

## Contexte

Deux types de comptes distincts : **Exploitant** et **Ayant droit**. Chaque compte peut avoir plusieurs utilisateurs avec des niveaux de permissions différents.

Règle métier clé : les ayants droits ne peuvent pas s'inscrire eux-mêmes — ils sont créés par les admins dans le backoffice.

---

## Tickets

### E01-001 — Inscription exploitant
**Priorité** : P0 | **Taille** : M

- Formulaire : email, mot de passe, nom de la société
- Validation email (lien de confirmation)
- Création du compte exploitant associé
- Redirection vers l'onboarding (compléter le profil)

---

### E01-002 — Connexion email + mot de passe
**Priorité** : P0 | **Taille** : S

- Page de connexion
- Gestion des erreurs (email inconnu, mdp incorrect)
- Session persistante (remember me)
- Redirection post-login selon le type de compte (exploitant / ayant droit / admin)

---

### E01-003 — MFA (TOTP)
**Priorité** : P1 | **Taille** : M

- Activation optionnelle depuis les paramètres du compte
- Support TOTP (Google Authenticator, Authy…)
- Codes de récupération générés à l'activation
- Forced MFA possible pour les admins

---

### E01-004 — Mot de passe oublié / reset
**Priorité** : P0 | **Taille** : S

- Formulaire "mot de passe oublié" → email avec lien tokenisé (expiration 1h)
- Page de réinitialisation
- Invalidation des sessions existantes après reset

---

### E01-005 — Invitation de membres au sein d'un compte
**Priorité** : P0 | **Taille** : M

- Un admin du compte peut inviter un collègue par email
- Email d'invitation avec lien tokenisé (expiration 7 jours)
- Le nouveau membre choisit son mot de passe à l'activation
- Applicable pour les deux types de comptes (exploitant et ayant droit)

---

### E01-006 — Gestion des rôles et permissions
**Priorité** : P0 | **Taille** : M

**Rôles pour un compte Exploitant** :
- `owner` : accès total, peut gérer les membres et supprimer le compte
- `admin` : peut gérer les membres, passer des commandes, accéder aux factures
- `member` : peut parcourir le catalogue et ajouter au panier, ne peut pas payer

**Rôles pour un compte Ayant Droit** :
- `owner` : accès total
- `admin` : peut gérer catalogue, valider les demandes, voir le wallet
- `member` : lecture seule

Interface de gestion des membres : liste, modification du rôle, révocation d'accès.

---

### E01-007 — Profil utilisateur
**Priorité** : P1 | **Taille** : S

- Nom, prénom, email (modification avec re-confirmation)
- Changement de mot de passe
- Activation/désactivation MFA
- Langue (FR / EN pour commencer)

---

### E01-008 — Déconnexion & gestion des sessions
**Priorité** : P0 | **Taille** : S

- Déconnexion manuelle
- Déconnexion de toutes les sessions actives
- Expiration automatique des sessions (configurable)
