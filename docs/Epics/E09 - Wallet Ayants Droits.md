# E09 — Wallet Ayants Droits

**Phase** : P3
**Outils** : Stripe Connect (payouts)

---

## Contexte

Chaque ayant droit dispose d'un wallet Stripe Connect. Après chaque transaction, sa part est créditée sur ce wallet. Il peut ensuite retirer les fonds vers son compte bancaire, manuellement ou automatiquement.

---

## Tickets

### E09-001 — Dashboard financier
**Priorité** : P0 | **Taille** : M

Vue principale du wallet :

- **Solde disponible** (prêt à être retiré)
- **Solde en attente** (fonds bloqués par Stripe pendant la période de rétention)
- **Revenus du mois en cours** vs mois précédent
- Graphique d'évolution des revenus (30 derniers jours / 12 derniers mois)

Tableau des transactions :
- Date, film, cinéma, montant brut, commission TIMELESS, montant net
- Statut : en attente / disponible / versé
- Filtres : période, film, cinéma

---

### E09-002 — Retrait manuel
**Priorité** : P0 | **Taille** : M

- Bouton "Retirer les fonds" depuis le dashboard
- Montant proposé = solde disponible total (modifiable)
- Sélection du compte bancaire (ajouté lors du KYC Stripe Connect)
- Confirmation avant exécution
- Délai affiché (généralement 1–2 jours ouvrés selon le pays)
- Notification email de confirmation du retrait

---

### E09-003 — Virement automatique
**Priorité** : P1 | **Taille** : M

Configuration depuis les paramètres du compte :
- Activer/désactiver le virement automatique
- Fréquence : quotidien / hebdomadaire / mensuel
- Seuil minimum (ex : ne déclencher un virement que si le solde > 100 EUR)
- Compte bancaire de destination (géré par Stripe Connect)

Stripe gère nativement les payout schedules — l'interface TIMELESS expose simplement les options.

---

### E09-004 — Historique des versements
**Priorité** : P1 | **Taille** : S

- Liste de tous les virements effectués (date, montant, statut, référence Stripe)
- Statuts : initié / en cours / versé / échoué
- Téléchargement d'un relevé (CSV ou PDF) sur une période donnée
