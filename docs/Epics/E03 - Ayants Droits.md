# E03 — Comptes Ayants Droits

**Phase** : P0

---

## Contexte

Les ayants droits (distributeurs, archives, producteurs…) sont les vendeurs de la marketplace. Ils ne peuvent pas s'inscrire eux-mêmes : leur compte est **créé par un admin TIMELESS** depuis le backoffice. Ils reçoivent ensuite une invitation pour activer leur accès.

---

## Modèle de données

```
Compte Ayant Droit
  └── Utilisateurs (avec rôles)
  └── Catalogue de films
  └── Wallet Stripe Connect
  └── Règle de commission (configurée par admin)
```

---

## Tickets

### E03-001 — Création du compte ayant droit (backoffice)
**Priorité** : P0 | **Taille** : S

Depuis le backoffice admin (E11) :
- Saisie de la raison sociale, pays, email de contact principal
- Définition de la commission (% pris par TIMELESS sur les transactions)
- Envoi automatique d'une invitation par email à l'email de contact

---

### E03-002 — Onboarding ayant droit
**Priorité** : P0 | **Taille** : M

L'ayant droit active son compte via le lien d'invitation :
- Création du mot de passe
- Complétion du profil : raison sociale, adresse, numéro de TVA
- Lancement du flow Stripe Connect (KYC) — voir E08

---

### E03-003 — Dashboard ayant droit
**Priorité** : P1 | **Taille** : M

Vue d'ensemble :
- Demandes de validation en attente (avec deadline)
- Dernières transactions
- Solde wallet (disponible / en attente de versement)
- Raccourci vers le catalogue

---

### E03-004 — Gestion des membres du compte
**Priorité** : P1 | **Taille** : S

- Liste des utilisateurs avec leur rôle
- Invitation par email
- Modification du rôle / révocation
