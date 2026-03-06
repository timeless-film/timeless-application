# E06 — Panier & Demandes

**Phase** : P2

---

## Contexte

Deux parcours distincts selon le type de film :

1. **Achat direct** → ajout au panier → paiement immédiat
2. **Validation requise** → demande envoyée à l'ayant droit → attente → si accepté → lien de paiement

Le panier ne contient que des films en **achat direct**. Les demandes en attente de validation sont dans un espace séparé "Mes demandes".

À chaque ajout (panier ou demande), l'exploitant renseigne les mêmes informations contextuelles.

---

## Tickets

### E06-001 — Modal d'ajout (panier ou demande)
**Priorité** : P0 | **Taille** : M

Déclenché au clic "Ajouter au panier" ou "Faire une demande" depuis la fiche film ou le catalogue.

Champs obligatoires :
- **Cinéma** (sélecteur parmi les cinémas du compte)
- **Salle** (sélecteur parmi les salles du cinéma sélectionné, avec capacité affichée)
- **Nombre de visionnages prévus** (entier > 0)
- **Date de début** (date picker)
- **Date de fin** (date picker, doit être ≥ date de début)

Validation :
- Date de début ≥ aujourd'hui + 1 jour minimum
- Récapitulatif avant confirmation (film, prix, infos renseignées)

---

### E06-002 — Panier exploitant
**Priorité** : P0 | **Taille** : M

Vue panier :
- Liste des films ajoutés (achat direct uniquement)
- Pour chaque film : titre, ayant droit, salle, dates, nb visionnages, prix unitaire
- Sous-total par devise (si les films ont des devises différentes, grouper par devise)
- Bouton "Supprimer" par ligne
- Bouton "Valider et payer"

Règles :
- Le panier est persistant (survit à la déconnexion)
- Un film ne peut être ajouté qu'une fois au panier pour une même salle + période (warning si doublon détecté)

---

### E06-003 — Validation du panier et paiement
**Priorité** : P0 | **Taille** : L

Voir E08 pour le détail du paiement Stripe.

Flow :
1. Récapitulatif final du panier (films, prix, TVA calculée automatiquement)
2. Affichage du numéro de TVA de l'exploitant si EU (reverse charge si B2B)
3. Stripe Checkout → paiement
4. Confirmation → les réservations passent en statut "payé / en attente de livraison"
5. Email de confirmation (voir E12)
6. Notification équipe ops TIMELESS (voir E10)

---

### E06-004 — Espace "Mes demandes" (validation requise)
**Priorité** : P0 | **Taille** : M

Tableau de suivi des demandes en attente de validation :

| Film | Ayant droit | Cinéma | Dates | Statut | Expiration |
|---|---|---|---|---|---|
| ... | ... | ... | ... | En attente | 2026-04-05 |

Statuts :
- `en_attente` — envoyée, pas encore traitée
- `validée` — acceptée, en attente de paiement
- `refusée` — refusée par l'ayant droit
- `expirée` — délai dépassé
- `payée` — paiement effectué

Actions disponibles :
- Si statut `validée` → bouton "Procéder au paiement" (lien Stripe)
- Si statut `en_attente` → bouton "Annuler la demande"

---

### E06-005 — Expiration automatique des demandes
**Priorité** : P0 | **Taille** : M

Une demande expire automatiquement si :
- Elle est en attente depuis **plus de 30 jours**, OU
- La **date de début est à moins de 7 jours** et elle n'est pas encore traitée

Implémentation :
- Job cron quotidien qui vérifie et expire les demandes éligibles
- Notification email aux deux parties à l'expiration (voir E12)
- Statut → `expirée`

---

### E06-006 — Relance de demande expirée
**Priorité** : P2 | **Taille** : S

- L'exploitant peut relancer une demande expirée (crée une nouvelle demande avec les mêmes infos pré-remplies)
- Confirmation requise avant relance

---

### E06-007 — Historique des commandes
**Priorité** : P1 | **Taille** : M

Vue complète pour l'exploitant :
- Toutes les réservations passées (payées + livrées)
- Filtres : cinéma, période, statut
- Accès à la facture Stripe pour chaque commande
- Statut de livraison DCP/KDM
