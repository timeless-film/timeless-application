# E08 — Paiement Stripe

**Phase** : P2–P3
**Outils** : Stripe Checkout, Stripe Connect, Stripe Tax, Stripe Billing

---

## Modèle de prix

Le prix affiché à l'exploitant n'est **pas** le prix catalogue fixé par l'ayant droit. TIMELESS applique une couche de marge et des frais de livraison configurables en backoffice.

```
prix_affiché = prix_catalogue × (1 + marge_plateforme%) + frais_livraison
```

**Exemple** :
- Ayant droit fixe le prix catalogue : 150 EUR
- Marge plateforme (admin) : 20%
- Frais de livraison (admin) : 50 EUR
- → Prix affiché à l'exploitant : 150 × 1.20 + 50 = **230 EUR**

**Répartition après paiement** :
- Ayant droit reçoit : `prix_catalogue × (1 - commission%)` → ex. 150 × 85% = **127.50 EUR**
- TIMELESS garde : `(prix_catalogue × marge%) + frais_livraison + (prix_catalogue × commission%)` → ex. 30 + 50 + 22.50 = **102.50 EUR**

**Paramètres configurables en backoffice** (voir E11-007) :
- `marge_plateforme` : % global appliqué à tous les films (défaut : à définir)
- `frais_livraison` : montant fixe en EUR par commande (défaut : 50 EUR)
- `commission_defaut` : % prélevé sur le prix catalogue de l'ayant droit (défaut : **15%**)
- `commission_par_ayant_droit` : override par compte (optionnel, configuré à la création — voir E03-001)

> L'ayant droit voit son prix catalogue dans son dashboard mais ne voit jamais le prix affiché côté exploitant.
> L'exploitant voit uniquement le prix final (prix_affiché), pas la décomposition.

---

## Contexte technique

TIMELESS est une marketplace : l'argent transite par la plateforme avant d'être reversé aux ayants droits. Stripe Connect (modèle "destination charges") est la solution adaptée.

La TVA est calculée automatiquement via Stripe Tax en fonction de l'adresse de l'exploitant et du type de transaction (B2B avec numéro de TVA EU = reverse charge possible).

---

## Tickets

> **Note** : La configuration du compte Stripe Connect (KYC, onboarding Express, webhook `account.updated`) a été déplacée dans **E03-002**. Elle est implémentée dès le setup du compte ayant droit, indépendamment du flow de paiement.

### E08-001 — Paiement du panier (achat direct)
**Priorité** : P0 | **Taille** : L

Flow :
1. Création d'une `PaymentIntent` Stripe avec les films du panier
2. Calcul de la TVA via Stripe Tax (adresse de l'exploitant → taux applicable)
3. Si exploitant B2B avec numéro de TVA EU valide → reverse charge (0% TVA)
4. Stripe Checkout hébergé (ou Stripe Elements pour une intégration plus custom)
5. Webhook `payment_intent.succeeded` → mise à jour statut commande → `payée`
6. Webhook `payment_intent.payment_failed` → notification à l'exploitant

---

### E08-002 — Paiement d'une demande validée
**Priorité** : P0 | **Taille** : M

- Création du lien de paiement Stripe lors de la validation par l'ayant droit
- Lien inclus dans l'email de notification au cinéma (E07-004)
- Lien accessible depuis "Mes demandes" (statut `validée`)
- Le lien expire au même moment que la demande
- Même logique TVA que E08-002

---

### E08-003 — Calcul du prix et splits de paiement
**Priorité** : P0 | **Taille** : L

**Calcul du prix affiché** (fait côté serveur, jamais côté client) :
```
prix_affiché = prix_catalogue × (1 + marge_plateforme) + frais_livraison
```

**Split après paiement (Stripe Connect "destination charges")** :
- TIMELESS encaisse le `prix_affiché` (hors TVA)
- Transfer vers l'ayant droit : `prix_catalogue × (1 - commission%)`
- TIMELESS conserve le reste (marge + frais livraison + commission)

Les paramètres utilisés pour le calcul sont **snapshotés au moment de la commande** (stockés sur la ligne de commande en base). Une modification des paramètres globaux n'affecte pas les commandes passées.

Chaque commande stocke :
- `prix_catalogue` (tel que fixé par l'ayant droit au moment de la commande)
- `marge_appliquee` (%)
- `frais_livraison_appliques` (montant fixe)
- `commission_appliquee` (%)
- `prix_affiche` (calculé)
- `montant_ayant_droit` (calculé)
- `montant_timeless` (calculé)

---

### E08-004 — Calcul automatique de la TVA (Stripe Tax)
**Priorité** : P1 | **Taille** : M

- Activation de Stripe Tax sur le compte TIMELESS
- Adresse de facturation = adresse du cinéma de l'exploitant
- Numéro de TVA EU validé → reverse charge B2B (0% TVA apparente)
- Numéro de TVA hors EU → selon les règles du territoire
- Pas de numéro de TVA → TVA du pays de l'acheteur appliquée

Affichage avant paiement : montant HT + TVA applicable + montant TTC.

---

### E08-005 — Gestion des numéros de TVA
**Priorité** : P1 | **Taille** : M

- Saisie du numéro de TVA dans le profil exploitant et ayant droit
- Validation en temps réel via l'API VIES (EU) pour les numéros européens
- Pour les numéros hors EU : saisie libre avec validation de format basique
- Le numéro validé est stocké sur le Customer Stripe correspondant

---

### E08-006 — Génération des factures
**Priorité** : P1 | **Taille** : M

- Facture générée automatiquement par Stripe après chaque paiement
- Accessible depuis l'historique des commandes (exploitant)
- Accessible depuis le dashboard financier (ayant droit)
- Format PDF, téléchargeable

---

### E08-007 — Gestion des remboursements
**Priorité** : P2 | **Taille** : M

- Les admins peuvent initier un remboursement depuis le backoffice
- Remboursement partiel ou total
- Le split est annulé proportionnellement (TIMELESS + ayant droit)
- Notification automatique à l'exploitant
- Mise à jour du statut de la commande → `remboursée`
