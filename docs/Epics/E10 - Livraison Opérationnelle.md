# E10 — Livraison Opérationnelle

**Phase** : P3

---

## Contexte

Après un paiement validé, la livraison du DCP et des KDM n'est pas automatisée — c'est l'équipe opérations de TIMELESS qui prend le relais en contactant le laboratoire concerné. La plateforme doit leur fournir toutes les informations nécessaires et permettre de suivre le statut de chaque livraison.

---

## Tickets

### E10-001 — Notification interne équipe ops après paiement
**Priorité** : P0 | **Taille** : M

Déclenché immédiatement après `payment_intent.succeeded` :

- Email automatique à l'adresse ops de TIMELESS (configurable en backoffice)
- Contenu : film, cinéma, salle, dates de diffusion, nb visionnages, ayant droit, coordonnées du labo si connues
- La commande apparaît immédiatement dans la file "Livraisons à traiter" du backoffice (E11)

---

### E10-002 — Interface de suivi des livraisons (backoffice)
**Priorité** : P0 | **Taille** : L

Vue dédiée dans le backoffice admin :

Tableau des livraisons en attente :
- Film, cinéma, date de début de diffusion, ayant droit
- Statut : `à traiter` / `en cours` / `livré`
- Urgence calculée automatiquement (date de début - aujourd'hui en jours)

Pour chaque livraison, actions disponibles :
- Changer le statut
- Ajouter une note interne (ex : "Contacté le labo le 06/03, livraison prévue le 10/03")
- Saisir les infos de livraison DCP/KDM (numéro de commande labo, date de livraison confirmée)
- Marquer comme "Livré"

Filtres : statut, urgence, ayant droit, période.

---

### E10-003 — Notification au cinéma à la livraison
**Priorité** : P0 | **Taille** : S

Déclenché quand l'ops passe une livraison en statut `livré` :
- Email à tous les utilisateurs `admin` / `owner` du cinéma
- Contenu : film livré, date de livraison, informations techniques (si saisies par l'ops)
- Mise à jour du statut dans "Historique des commandes" de l'exploitant

---

### E10-004 — Alertes de retard
**Priorité** : P2 | **Taille** : S

- Job cron quotidien : si une livraison est toujours en statut `à traiter` ou `en cours` et que la date de début est à moins de 5 jours → alerte interne ops (email + flag rouge dans l'interface)
