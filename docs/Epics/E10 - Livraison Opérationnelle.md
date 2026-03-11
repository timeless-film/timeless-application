# E10 — Livraison Opérationnelle

**Phase** : P3
**Statut** : ⬜ À faire

---

## Contexte

Après un paiement validé, la livraison du DCP et des KDM n'est pas automatisée — c'est l'équipe opérations de TIMELESS qui prend le relais en contactant le laboratoire concerné. La plateforme doit leur fournir toutes les informations nécessaires, permettre de suivre le statut de chaque livraison item par item, et informer l'exploitant à chaque étape.

### Modèle de données

Le suivi de livraison est géré au niveau de chaque **item de commande** (`orderItems`), pas au niveau de la commande entière. Un panier de 3 films génère 3 items — chacun peut être livré indépendamment.

Champs pertinents dans `orderItems` :
- `deliveryStatus` : `pending` | `in_progress` | `delivered`
- `deliveryNotes` : notes internes de l'équipe ops (ex : "Labo contacté le 06/03")
- `deliveredAt` : timestamp de la livraison confirmée

Champs pertinents dans `orders` :
- `status` : `paid` | `processing` | `delivered` | `refunded`

Règle de cohérence : quand **tous** les items d'une commande passent en `delivered`, le statut de la commande (`orders.status`) passe automatiquement à `delivered`.

---

## Tickets

### E10-001 — Notification interne équipe ops après paiement
**Priorité** : P0 | **Taille** : M

**Déclencheur** : webhook Stripe `payment_intent.succeeded` — immédiatement après la création de la commande dans la base.

**Actions** :
1. Envoi d'un email automatique à l'adresse `opsEmail` configurée dans `platformSettings` (défaut : `ops@timeless.film`)
2. Chaque item de la commande est créé avec `deliveryStatus = pending`

**Contenu de l'email** :

```
Sujet : [TIMELESS] Nouvelle commande à livrer — #[orderNumber] — [Nom du cinéma]

Commande #[orderNumber] — [date du paiement]
Cinéma : [companyName], [ville], [pays]

Films à livrer :
1. [Titre du film]
   Ayant droit : [companyName de l'ayant droit]
   Salle : [nom de la salle]
   Dates : du [startDate] au [endDate] — [screeningCount] séance(s)
   [Lien vers la fiche de livraison dans le backoffice]

[Si plusieurs items : répéter pour chaque film]

Lien vers la commande dans le backoffice : [URL]
```

**Critères d'acceptance** :
- L'email est envoyé dans les 30 secondes suivant le paiement
- En cas d'échec d'envoi : log d'erreur + retry automatique (pas de blocage du paiement)
- Si `opsEmail` n'est pas configuré : log d'erreur, l'interface backoffice reste fonctionnelle

---

### E10-002 — Interface de suivi des livraisons (backoffice)
**Priorité** : P0 | **Taille** : L

Vue dédiée accessible depuis la sidebar admin : `/deliveries`.

#### Liste des livraisons

Tableau paginé, **une ligne par item** (`orderItem`), avec les colonnes :

| Colonne | Description |
|---|---|
| Urgence | Badge coloré : 🔴 < 3 jours / 🟠 3–7 jours / 🟢 > 7 jours (calculé sur `startDate - aujourd'hui`) |
| Commande | `#[orderNumber]` (lien vers détail commande) |
| Film | Titre du film (poster miniature optionnel) |
| Cinéma | Nom du cinéma + ville |
| Ayant droit | Nom de l'ayant droit |
| Début de diffusion | `startDate` |
| Statut | Badge : `À traiter` / `En cours` / `Livré` |
| Actions | Bouton "Gérer" |

**Filtres disponibles** :
- Statut : Tous / À traiter / En cours / Livré
- Urgence : Tous / Urgent (< 7 jours)
- Ayant droit : dropdown
- Période (mois de la date de début)

**Tri par défaut** : urgence croissante (les plus urgents en premier).

**Compteurs en haut de page** :
- "X à traiter" / "Y en cours" / "Z livrés ce mois"

#### Panneau de gestion d'une livraison

Ouverture en slide-over ou page dédiée `/deliveries/[itemId]` :

**Informations affichées** (lecture seule) :
- Titre du film, affiche
- Cinéma, salle, dates, nombre de séances
- Ayant droit + coordonnées de contact
- Numéro de commande + lien
- Exploitant + email de contact

**Actions disponibles** :

1. **Changer le statut**
   - `pending` → `in_progress` (bouton "Marquer en cours")
   - `in_progress` → `delivered` (bouton "Marquer livré")
   - Retour possible : `in_progress` → `pending` (avec confirmation)
   - Passage à `delivered` : confirmation obligatoire ("Confirmer la livraison ?") + `deliveredAt` positionné automatiquement

2. **Ajouter une note interne**
   - Champ texte libre, sauvegarde dans `deliveryNotes`
   - Les notes existantes sont affichées avec horodatage (sur la base du `updatedAt` de l'item)
   - Visible uniquement par les admins TIMELESS, jamais par l'exploitant

**Effets du passage en `delivered`** :
- `orderItems.deliveredAt` = `now()`
- Si tous les items de la commande sont `delivered` → `orders.status` = `delivered`
- Déclenchement de E10-003 (notification au cinéma)
- Entrée dans l'audit log (`action: "delivery.delivered"`)

**Critères d'acceptance** :
- Le changement de statut est persisté immédiatement
- La liste se rafraîchit automatiquement après action
- Toute modification de statut est tracée dans `auditLogs`

---

### E10-003 — Notification au cinéma à la livraison
**Priorité** : P0 | **Taille** : S

**Déclencheur** : passage d'un item en statut `delivered` depuis le backoffice.

**Destinataires** : tous les utilisateurs `owner` et `admin` du compte exploitant concerné.

**Contenu de l'email** :

```
Sujet : [TIMELESS] Votre film est prêt — [Titre du film]

Bonjour [prénom],

Votre commande pour [Titre du film] est prête à être diffusée.

Détails de livraison :
- Film : [Titre complet]
- Salle : [nom de la salle], [nom du cinéma]
- Dates de diffusion : du [startDate] au [endDate]
- Livré le : [deliveredAt, formaté JJ/MM/AAAA]

[Si des notes techniques ont été saisies par l'ops :]
Informations techniques : [deliveryNotes]

Pour toute question : ops@timeless.film

L'équipe TIMELESS
```

**Mise à jour visible pour l'exploitant** : le statut de livraison dans "Historique des commandes" passe à "Livré" (cf. E10-005).

**Critères d'acceptance** :
- L'email est envoyé dans la minute suivant le changement de statut
- Si plusieurs admins/owners : chacun reçoit l'email individuellement
- En cas d'échec : log d'erreur + retry ; le statut en DB n'est pas annulé

---

### E10-004 — Alertes de retard
**Priorité** : P2 | **Taille** : S

**Mécanisme** : job cron quotidien (déclenché à 8h00 UTC).

**Condition d'alerte** : item avec `deliveryStatus` ∈ `{pending, in_progress}` ET `startDate <= today + [requestUrgencyDaysBeforeStart]` jours (paramètre configurable dans `platformSettings`, défaut : 7 jours).

**Actions** :
1. Email d'alerte à `opsEmail` listant tous les items concernés, triés par urgence croissante
2. Ces items reçoivent un flag visuel "Urgent" (badge rouge) dans l'interface de suivi

**Contenu de l'email d'alerte** :
```
Sujet : [TIMELESS] ⚠️ X livraisons urgentes à traiter

Les livraisons suivantes doivent être traitées en priorité :

1. [Titre] — [Cinéma] — Diffusion le [startDate] (dans J jours)
   Statut actuel : [À traiter / En cours]
   [URL vers la fiche de livraison]

[...]
```

**Critères d'acceptance** :
- Le cron ne s'exécute qu'une fois par jour (idempotent)
- Si aucune livraison urgente : aucun email n'est envoyé
- Le seuil d'urgence est celui configuré dans `platformSettings.requestUrgencyDaysBeforeStart`

---

### E10-005 — Statut de livraison dans l'historique commandes de l'exploitant
**Priorité** : P1 | **Taille** : S

**Contexte** : l'exploitant doit pouvoir suivre l'avancement de ses livraisons sans attendre l'email de confirmation. Le statut de chaque film dans une commande doit être visible dans son espace.

**Localisation** : page "Historique des commandes" (`/(app)/orders`) — dans la vue détail d'une commande.

**Affichage** :
- Dans la liste des items d'une commande, chaque ligne affiche un badge de statut de livraison :
  - `En attente` (gris) — item en `pending`
  - `En cours de livraison` (orange) — item en `in_progress`
  - `Livré` (vert) + date de livraison — item en `delivered`

**Ce qui n'est PAS affiché à l'exploitant** :
- Les notes internes (`deliveryNotes`) — réservées aux admins
- L'identité de l'admin ayant effectué le changement

**Critères d'acceptance** :
- Le badge est visible sans rechargement après mise à jour par l'ops (au prochain chargement de la page)
- Le statut "Livré" inclut la date au format local de l'utilisateur
- Pas de polling temps réel requis pour le prototype

---

## Récapitulatif

| Ticket | Titre | Priorité | Taille | Statut |
|---|---|---|---|---|
| E10-001 | Notification interne ops après paiement | P0 | M | ⬜ À faire |
| E10-002 | Interface de suivi des livraisons (backoffice) | P0 | L | ⬜ À faire |
| E10-003 | Notification au cinéma à la livraison | P0 | S | ⬜ À faire |
| E10-004 | Alertes de retard | P2 | S | ⬜ À faire |
| E10-005 | Statut de livraison dans l'historique commandes | P1 | S | ⬜ À faire |
