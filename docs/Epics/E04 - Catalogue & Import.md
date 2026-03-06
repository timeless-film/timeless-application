# E04 — Catalogue & Import

**Phase** : P1

---

## Contexte

Les ayants droits alimentent leur catalogue de deux façons :
1. **Import CSV/Excel** — pour les mises à jour en masse
2. **CRUD manuel** — pour ajouter/modifier un film à la main

À chaque ajout d'un film, la plateforme **enrichit automatiquement les métadonnées** via l'API TMDB (The Movie Database).

Un film peut avoir des **prix différents selon les pays/zones**, avec des devises distinctes.

---

## Modèle de données (film)

```
Film
  ├── Titre original + titre local
  ├── Ayant droit (FK)
  ├── Statut : actif / inactif / retiré
  ├── Type : achat_direct | validation_requise
  ├── Données TMDB : synopsis, durée, cast, genre, année, affiche, pays de tournage...
  ├── Prix par zone [
  │     { pays: ["FR", "BE", "CH"], prix: 150, devise: "EUR" },
  │     { pays: ["US", "CA"], prix: 200, devise: "USD" },
  │     ...
  │   ]
  └── Métadonnées import : date d'ajout, source (csv/manuel), dernière mise à jour
```

---

## Tickets

### E04-001 — Import CSV/Excel
**Priorité** : P0 | **Taille** : L

Format du fichier attendu (colonnes) :
- `titre` — titre du film
- `type` — `direct` ou `validation`
- `pays` — liste de pays séparés par virgule (ex : `FR,BE,CH`)
- `prix` — entier
- `devise` — code ISO (ex : `EUR`, `USD`)
- `statut` — `actif` / `inactif` (optionnel, défaut : actif)

Comportement :
- Si le film existe déjà (même titre + même ayant droit) → mise à jour
- Si nouveau film → création + enrichissement TMDB automatique (E04-005)
- Un même film peut avoir plusieurs lignes pour des zones/devises différentes

Interface :
- Upload du fichier (drag & drop)
- Prévisualisation avant import (tableau avec erreurs détectées en rouge)
- Rapport post-import : X créés, Y mis à jour, Z erreurs

---

### E04-002 — Validation et détection d'erreurs à l'import
**Priorité** : P0 | **Taille** : M

- Colonne obligatoire manquante → erreur bloquante
- Devise non reconnue → warning
- Pays non reconnu → warning
- Prix négatif ou non numérique → erreur
- Doublons dans le fichier → warning avec résolution proposée
- Résumé clair : l'ayant droit peut corriger et re-importer

---

### E04-003 — Création manuelle d'un film
**Priorité** : P0 | **Taille** : M

Formulaire :
- Titre (avec recherche TMDB en temps réel dès la saisie)
- Sélection du résultat TMDB correspondant (ou "aucun résultat")
- Type : achat direct / validation requise
- Statut : actif / inactif
- Ajout des lignes de prix (pays + prix + devise)

---

### E04-004 — Édition et suppression d'un film
**Priorité** : P0 | **Taille** : S

- Modification de tous les champs
- Modification des lignes de prix (ajout, modification, suppression d'une zone)
- Archivage (soft delete) — un film supprimé reste visible dans l'historique des commandes

---

### E04-005 — Enrichissement automatique TMDB
**Priorité** : P1 | **Taille** : L

Déclenché automatiquement à chaque création de film (import ou manuel) :

Données récupérées depuis TMDB :
- Synopsis (FR + EN)
- Durée
- Date de sortie / année
- Genre(s)
- Distribution (cast) — noms des acteurs principaux
- Réalisateur(s)
- Pays d'origine / lieux de tournage
- Affiche (poster)
- Backdrop image
- Note moyenne TMDB

Stratégie de matching :
- Recherche par titre + année si disponible
- Si plusieurs résultats → sélection du meilleur match (score de confiance)
- Si match incertain → flaguer pour review manuelle

---

### E04-006 — Correction manuelle des données TMDB
**Priorité** : P2 | **Taille** : M

- L'ayant droit peut voir les données TMDB sur la fiche film
- Il peut les modifier manuellement (les modifications écrasent les données TMDB)
- Il peut lancer un re-fetch TMDB manuellement
- Il peut désassocier un film de son entrée TMDB

---

### E04-007 — Gestion des prix multi-zones
**Priorité** : P0 | **Taille** : M

Interface dédiée sur la fiche film :
- Tableau des zones : pays (multi-select ou saisie libre séparée par virgules), prix, devise
- Ajout d'une nouvelle zone
- Modification d'une zone existante
- Suppression d'une zone

Logique d'affichage pour l'exploitant :
- Le prix affiché correspond à la zone qui inclut le pays du cinéma
- Si aucune zone ne correspond → film affiché avec "tarif sur demande" ou masqué

---

### E04-008 — Statut et visibilité d'un film
**Priorité** : P0 | **Taille** : S

- `actif` : visible dans le catalogue exploitant
- `inactif` : masqué du catalogue, accessible uniquement depuis le back ayant droit
- `retiré` : archivé, plus modifiable, conservé pour l'historique
- Changement de statut depuis la liste et depuis la fiche film
