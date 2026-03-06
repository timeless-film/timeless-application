# E07 — Workflow de Validation par l'Ayant Droit

**Phase** : P2

---

## Contexte

Certains films nécessitent une validation explicite de l'ayant droit avant que la transaction puisse avoir lieu. Ce workflow doit être simple, rapide, et accessible depuis l'email directement (sans avoir à se connecter).

---

## Tickets

### E07-001 — Envoi de l'email de demande à l'ayant droit
**Priorité** : P0 | **Taille** : M

Déclenché dès qu'un exploitant soumet une demande pour un film "validation requise".

L'email contient :
- Nom du film demandé
- Informations sur l'exploitant : raison sociale, pays, numéro de TVA
- Informations légales sur le cinéma (adresse, données réglementaires)
- Nombre de visionnages prévus
- Date de début et date de fin
- Salle sélectionnée (capacité)
- Prix correspondant à ce territoire
- Date d'expiration de la demande
- Deux boutons CTA : **Accepter** / **Refuser**
- Lien de secours vers le dashboard si les boutons ne fonctionnent pas

Les CTA sont des liens tokenisés à usage unique (token JWT signé avec expiration = expiration de la demande).

---

### E07-002 — Acceptation / refus depuis l'email
**Priorité** : P0 | **Taille** : M

- Clic sur "Accepter" → page de confirmation (sans connexion requise) → statut → `validée`
- Clic sur "Refuser" → page avec champ optionnel "motif du refus" → statut → `refusée`
- Si le token est expiré → message explicite "Cette demande a expiré"
- Si la demande a déjà été traitée → message "Cette demande a déjà été traitée"

---

### E07-003 — Interface de validation dans le dashboard ayant droit
**Priorité** : P1 | **Taille** : M

Pour les utilisateurs qui préfèrent gérer depuis l'interface :
- Liste des demandes en attente, triées par urgence (expiration la plus proche en premier)
- Fiche détaillée de chaque demande (mêmes infos que l'email)
- Boutons Accepter / Refuser avec confirmation
- Champ motif de refus (optionnel)
- Filtres : en attente / traitées / expirées

---

### E07-004 — Notification au cinéma après validation
**Priorité** : P0 | **Taille** : S

Si **acceptée** :
- Email à tous les utilisateurs du cinéma ayant le rôle `admin` ou `owner`
- Contenu : film accepté, récapitulatif de la demande, bouton "Procéder au paiement" (lien Stripe Checkout pré-configuré)
- La demande passe en statut `validée` dans "Mes demandes"

Si **refusée** :
- Email à tous les utilisateurs du cinéma avec le motif si renseigné
- La demande passe en statut `refusée`

---

### E07-005 — Notification d'expiration
**Priorité** : P0 | **Taille** : S

Lors de l'expiration automatique (voir E06-005) :
- Email à l'ayant droit : "La demande de [Cinéma X] pour [Film Y] a expiré"
- Email à l'exploitant : "Votre demande pour [Film Y] a expiré — vous pouvez en soumettre une nouvelle"
