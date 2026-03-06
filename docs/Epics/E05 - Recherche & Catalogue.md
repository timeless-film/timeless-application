# E05 — Recherche & Catalogue

**Phase** : P1

---

## Contexte

La page catalogue est la page principale pour les exploitants. Elle doit permettre de parcourir et filtrer l'ensemble des films disponibles, en tenant compte du territoire du cinéma pour afficher les bons prix. Les données enrichies via TMDB rendent les filtres puissants.

---

## Tickets

### E05-001 — Page catalogue avec filtres
**Priorité** : P0 | **Taille** : L

Filtres disponibles :
- **Titre** (recherche textuelle full-text)
- **Réalisateur**
- **Acteur / Distribution**
- **Ayant droit**
- **Genre**
- **Année de sortie** (range)
- **Durée** (range en minutes)
- **Pays d'origine / lieu de tournage**
- **Type** : achat direct uniquement / tous
- **Disponibilité** : afficher uniquement les films avec un prix pour mon territoire

Affichage :
- Grille de cards (affiche TMDB + titre + ayant droit + prix territoire + type)
- Vue liste (tableau dense, utile pour les pros)
- Pagination ou infinite scroll
- Tri : pertinence, titre A-Z, année, prix

---

### E05-002 — Fiche film détaillée
**Priorité** : P0 | **Taille** : M

Contenu :
- Affiche + backdrop TMDB
- Titre original + titre local
- Synopsis
- Réalisateur, cast principal
- Durée, année, genre, pays de tournage
- Ayant droit (avec logo si disponible)
- Type : "Achat direct" ou "Validation requise" (badge visible)
- Prix pour le territoire de l'exploitant connecté (avec devise)
  - Si devise de préférence différente → affichage indicatif avec taux de change
- Bouton "Ajouter au panier" ou "Faire une demande"

---

### E05-003 — Affichage du prix dans la devise de préférence
**Priorité** : P2 | **Taille** : M

- Récupération du taux de change via une API (ex : Open Exchange Rates, Frankfurter)
- Mise en cache des taux (toutes les heures)
- Affichage : "150 EUR (~162 USD au taux du jour)"
- Note claire que le paiement se fait dans la devise de l'ayant droit
- L'exploitant peut changer sa devise de préférence depuis son profil (E02-006)

---

### E05-004 — Catalogue vue Ayant Droit
**Priorité** : P1 | **Taille** : M

Vue distincte pour les ayants droits (leur propre catalogue) :
- Liste de tous leurs films avec statut, prix par zone, type
- Indicateurs : nombre de réservations, revenus générés par film
- Accès rapide à l'édition
- Filtres : statut, type, zone géographique
