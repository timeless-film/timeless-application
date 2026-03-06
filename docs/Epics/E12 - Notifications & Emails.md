# E12 — Notifications & Emails

**Phase** : P2–P3
**Outil** : Customer.io

---

## Contexte

Customer.io centralise tous les emails transactionnels et de lifecycle. Tous les utilisateurs (exploitants et ayants droits) sont synchronisés avec leurs propriétés et événements. Les emails transactionnels critiques (validation, paiement) utilisent les API transactionnelles de Customer.io ; les emails de lifecycle (onboarding, relances) utilisent les campaigns.

---

## Architecture Customer.io

**Identifiants** :
- `user_id` — ID unique de l'utilisateur
- `account_id` — ID du compte (exploitant ou ayant droit)

**Propriétés synchronisées** :
- Type de compte (`exploitant` / `ayant_droit`)
- Pays, devise de préférence
- Statut d'onboarding
- Statut Stripe Connect (pour les ayants droits)

**Événements trackés** :
- `account_created`, `user_invited`, `user_activated`
- `film_added`, `film_imported`
- `cart_item_added`, `checkout_completed`
- `request_submitted`, `request_validated`, `request_refused`, `request_expired`
- `payment_succeeded`, `payment_failed`
- `delivery_confirmed`
- `withdrawal_initiated`, `withdrawal_completed`

---

## Tickets

### E12-001 — Setup Customer.io
**Priorité** : P0 | **Taille** : M

- Configuration du workspace Customer.io
- Intégration du SDK server-side (Node.js)
- Sync automatique des utilisateurs à la création / modification
- Envoi des événements via l'API Track
- Templates de base (layout, header, footer TIMELESS)

---

### E12-002 — Email bienvenue exploitant
**Priorité** : P1 | **Taille** : S

Déclenché : `account_created` (exploitant)
- Contenu : bienvenue, rappel des étapes d'onboarding (compléter profil, ajouter cinéma)
- CTA : "Compléter mon profil"

---

### E12-003 — Email invitation membre
**Priorité** : P0 | **Taille** : S

Déclenché : invitation d'un nouveau membre
- Contenu : "[Nom] vous invite à rejoindre [Compte] sur TIMELESS"
- CTA : lien d'activation (tokenisé, expiration 7 jours)

---

### E12-004 — Email demande de validation → ayant droit
**Priorité** : P0 | **Taille** : M

Voir [[E07 - Workflow Validation#E07-001]].
- Email riche avec toutes les infos du cinéma et de la demande
- Deux boutons CTA : Accepter / Refuser (liens tokenisés)

---

### E12-005 — Email résultat de validation → cinéma
**Priorité** : P0 | **Taille** : S

Deux variantes :
- **Acceptée** : film approuvé, CTA "Procéder au paiement" avec lien Stripe
- **Refusée** : motif affiché si renseigné, suggestion de contacter TIMELESS

Destinataires : tous les utilisateurs `admin` / `owner` du cinéma.

---

### E12-006 — Email confirmation de paiement
**Priorité** : P0 | **Taille** : S

Déclenché : `payment_succeeded`
- Récapitulatif des films commandés, montant TTC, TVA
- Lien vers la facture
- Mention : "Votre DCP sera livré prochainement"

---

### E12-007 — Email confirmation de livraison DCP/KDM
**Priorité** : P0 | **Taille** : S

Déclenché : passage en statut `livré` (par l'ops)
- Film, cinéma, salle
- Informations de livraison si disponibles (référence, date)

---

### E12-008 — Email expiration de demande
**Priorité** : P0 | **Taille** : S

Deux variantes :
- **À l'exploitant** : votre demande pour [Film] a expiré, CTA "Soumettre une nouvelle demande"
- **À l'ayant droit** : la demande de [Cinéma] pour [Film] a expiré automatiquement
