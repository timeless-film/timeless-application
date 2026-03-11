# E11 — Backoffice Admin

**Phase** : P3
**Prérequis de** : [[E10 - Livraison Opérationnelle]] (E10 construit ses vues dans le backoffice créé ici)

---

## Contexte

Le backoffice est réservé aux membres de l'équipe TIMELESS. Il centralise la supervision de la plateforme, la gestion des comptes, la configuration des commissions, et le suivi opérationnel.

---

## Tickets

### E11-001 — Dashboard global
**Priorité** : P1 | **Taille** : M

Métriques principales :
- Volume de transactions (jour / mois / cumulé)
- Revenus TIMELESS (commissions encaissées)
- Nombre de réservations actives / en attente de livraison
- Nombre de demandes en attente de validation
- Utilisateurs actifs (exploitants + ayants droits)

Graphiques :
- Évolution des transactions dans le temps
- Top films les plus réservés
- Top exploitants par volume

---

### E11-002 — Gestion des ayants droits
**Priorité** : P0 | **Taille** : L

Liste des comptes ayants droits avec :
- Nom, pays, statut Stripe Connect (onboarding complet / incomplet)
- Commission configurée
- Nombre de films dans le catalogue
- Volume de transactions

Actions :
- **Créer un ayant droit** (formulaire + envoi invitation)
- **Modifier** : raison sociale, commission, statut (actif / suspendu)
- **Voir le catalogue** de l'ayant droit
- **Voir les transactions** de l'ayant droit
- **Suspendre** un compte (désactive l'accès et masque les films du catalogue)

---

### E11-003 — Gestion des exploitants
**Priorité** : P1 | **Taille** : M

Liste des comptes exploitants avec :
- Nom, pays, nombre de cinémas, volume de transactions
- Statut : actif / suspendu

Actions :
- Consulter le détail du compte
- Suspendre / réactiver un compte
- Voir l'historique des commandes

Pas de création manuelle (les exploitants s'inscrivent eux-mêmes).

---

### E11-004 — Configuration des commissions par ayant droit
**Priorité** : P0 | **Taille** : S

Depuis la fiche d'un ayant droit :
- Modifier le taux de commission (%, défaut : 10%)
- Historique des modifications (date, ancienne valeur, nouvelle valeur, admin qui a modifié)
- Note : la modification ne s'applique qu'aux nouvelles transactions

---

### E11-007 — Configuration globale des tarifs plateforme
**Priorité** : P0 | **Taille** : M

Section "Paramètres tarifaires" dans le backoffice :

| Paramètre | Type | Défaut | Description |
|---|---|---|---|
| Marge plateforme | % | À définir | Appliquée sur tous les films |
| Frais de livraison | Montant fixe (EUR) | 50 EUR | Ajoutés à chaque commande |
| Commission par défaut | % | 10% | Appliquée si pas d'override sur l'ayant droit |

- Modification de ces paramètres avec confirmation obligatoire
- Historique des modifications (qui, quand, ancienne/nouvelle valeur)
- Aperçu en temps réel : "Avec ces paramètres, un film catalogué à 150 EUR sera affiché à X EUR"
- Les paramètres en vigueur au moment d'une commande sont snapshotés (ne changent jamais rétroactivement)

---

### E11-005 — Supervision des livraisons
**Priorité** : P0 | **Taille** : S

Intégration de la vue E10-002 dans le backoffice.
Voir [[E10 - Livraison Opérationnelle]].

---

### E11-006 — Logs et audit trail
**Priorité** : P2 | **Taille** : M

Journal des actions sensibles :
- Création / modification / suspension de comptes
- Modifications de commissions
- Remboursements initiés
- Changements de statut de livraison

Chaque entrée : date, admin concerné, action, entité modifiée, anciennes/nouvelles valeurs.
Filtres : type d'action, admin, période.
