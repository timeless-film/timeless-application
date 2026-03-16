# E14 — Enrichissement TMDB & Données Normalisées

**Phase** : P4
**Statut** : ✅ Done

---

## Contexte

L'intégration TMDB actuelle (E04) est fonctionnelle mais limitée :
- Les **genres** sont stockés comme labels localisés en français (`"Horreur"`, `"Drame"`) au lieu d'IDs TMDB. Impossible de les afficher dans la bonne langue selon la locale de l'utilisateur.
- Les **crédits** sont réduits aux noms (réalisateurs + top 10 acteurs). On perd les producteurs, directeurs photo, compositeurs, sociétés de production — des données essentielles pour des professionnels du cinéma.
- La **fiche film** côté exploitant est minimaliste : grille d'infos basique alors que TMDB fournit des données très riches.
- Les **filtres catalogue** ne permettent pas de chercher par producteur, société de production, ou autres rôles créatifs.

Cet epic normalise les données TMDB dans des tables relationnelles dédiées pour permettre :
1. Des genres multilingues (stockés par ID, affichés dans la locale courante).
2. Une fiche film enrichie (équipe complète, sociétés de production, note TMDB).
3. Des filtres catalogue avancés (par acteur, réalisateur, producteur, société de production).

---

## Dépendances

- **E04** — Catalogue & Import (enrichissement TMDB initial)
- **E05** — Recherche & Catalogue (filtres existants à étendre)

---

## Décisions Produit

1. **Genres par ID interne** : table `genres` avec IDs séquentiels internes et une colonne `tmdbId` pour le mapping TMDB. Permet d'ajouter d'autres sources de données dans le futur.
2. **Personnes** : table `film_people` normalisée avec rôle (`director`, `actor`, `producer`, `composer`, `cinematographer`). On stocke le nom TMDB, l'ID TMDB et optionnellement la photo.
3. **Sociétés de production** : table `film_companies` pour filtrage et affichage.
4. **Rétrocompatibilité** : les colonnes `genres[]`, `directors[]`, `cast[]` restent sur `films` comme cache texte pour le search ILIKE existant. Les nouvelles tables sont la source de vérité pour l'affichage et les filtres.
5. **Backfill** : les films existants sont migrés via un script qui relit `tmdb_data` (jsonb snapshot) pour peupler les nouvelles tables.
6. **Sync TMDB** : à chaque enrichissement TMDB (création, re-sync), les tables normalisées sont mises à jour dans la même transaction.
7. **Fiche film** : afficher l'équipe complète (réalisation, acteurs, producteurs, DOP, compositeur), les sociétés de production, la note TMDB, et la tagline.
8. **Filtres catalogue** : ajouter des filtres par acteur, réalisateur et société de production (multi-select avec facets).
9. **Rôles crew extraits** : `director`, `producer`, `executive_producer`, `original_music_composer`, `director_of_photography`, `screenplay`. Périmètre extensible.

---

## Modèle de données

### Nouvelles tables

```
genres
  └── id (serial, PK) ← ID interne séquentiel
  └── tmdbId (integer, unique, nullable) ← ID TMDB pour le mapping (28 = Action, etc.)
  └── nameEn (text) ← Label anglais
  └── nameFr (text) ← Label français
  └── createdAt

film_genres
  └── filmId (uuid, FK films.id, cascade)
  └── genreId (integer, FK genres.id) ← Référence l'ID interne
  └── PK composite (filmId, genreId)

film_people
  └── id (uuid, PK)
  └── filmId (uuid, FK films.id, cascade)
  └── tmdbPersonId (integer, nullable) ← TMDB person ID
  └── name (text)
  └── role (enum: director | actor | producer | executive_producer | composer | cinematographer | screenplay)
  └── character (text, nullable) ← Nom du personnage (acteurs)
  └── displayOrder (integer) ← Ordre d'affichage
  └── profileUrl (text, nullable) ← Photo TMDB

film_companies
  └── id (uuid, PK)
  └── filmId (uuid, FK films.id, cascade)
  └── tmdbCompanyId (integer, nullable)
  └── name (text)
  └── logoUrl (text, nullable)
  └── originCountry (text, nullable) ← ISO code
```

### Colonnes ajoutées à `films`

```
tagline (text, nullable) ← Tagline TMDB (ex. "L'exorcisme le plus terrifiant de l'histoire")
taglineEn (text, nullable) ← Tagline anglaise
```

---

## Suivi d'Avancement Tickets

| Ticket | Statut | Attendus |
|---|---|---|
| E14-001 | ✅ Done | Schéma DB (tables + enums + relations + migration) |
| E14-002 | ✅ Done | Sync TMDB normalisée (normalizeTmdbData + enrichissement) |
| E14-003 | ✅ Done | Backfill des films existants depuis `tmdb_data` jsonb |
| E14-004 | ✅ Done | Fiche film enrichie (équipe, sociétés, note, tagline) |
| E14-005 | ✅ Done | Filtres catalogue avancés (acteur, réalisateur, société) |
| E14-006 | ✅ Done | Données manuelles → tables normalisées + genre sélecteur |
| E14-007 | ✅ Done | Découplage genres TMDB → IDs internes + colonne `tmdbId` |
| E14-008 | ✅ Done | Seeding genres depuis admin settings |

---

## Tickets

---

### E14-001 — Schéma DB normalisé
**Priorité** : P0 | **Taille** : M

#### Objectif

Créer les tables `tmdb_genres`, `film_genres`, `film_people`, `film_companies` et ajouter `tagline`/`taglineEn` à `films`.

#### Tâches

| Tâche | Statut |
|-------|--------|
| Créer enum `film_person_role` | ✅ |
| Créer table `tmdb_genres` → renommée `genres` (serial PK, `tmdbId` unique, nameEn, nameFr) | ✅ |
| Créer table `film_genres` (filmId + genreId → `genres.id`, PK composite) | ✅ |
| Créer table `film_people` (filmId, tmdbPersonId, name, role, character, displayOrder, profileUrl) | ✅ |
| Créer table `film_companies` (filmId, tmdbCompanyId, name, logoUrl, originCountry) | ✅ |
| Ajouter `tagline` et `taglineEn` à `films` | ✅ |
| Seed de la table `tmdb_genres` avec les 19 genres TMDB (IDs fixes) | ✅ |
| Exporter toutes les tables depuis `schema/index.ts` | ✅ |
| Générer la migration Drizzle | ✅ |

---

### E14-002 — Sync TMDB normalisée
**Priorité** : P0 | **Taille** : M

#### Objectif

Adapter `normalizeTmdbData()` et le flow d'enrichissement pour peupler les tables normalisées à chaque sync TMDB.

#### Tâches

| Tâche | Statut |
|-------|--------|
| Étendre `TmdbMovie` pour inclure `production_companies` et crew complet | ✅ |
| Extraire genres comme IDs (pas noms) dans `normalizeTmdbData()` | ✅ |
| Extraire crew par rôle (director, producer, exec producer, composer, DOP, screenplay) | ✅ |
| Extraire production companies | ✅ |
| Extraire tagline + tagline EN (depuis translations) | ✅ |
| Créer `syncFilmTmdbRelations(filmId, normalizedData)` dans film-service | ✅ |
| Appeler `syncFilmTmdbRelations` dans `createFilmAction` et `resyncTmdbAction` | ✅ |
| Appeler `syncFilmTmdbRelations` dans le batch enrichment route | ✅ |
| Conserver les colonnes `genres[]`, `directors[]`, `cast[]` sur `films` comme cache texte | ✅ |

---

### E14-003 — Backfill des films existants
**Priorité** : P0 | **Taille** : S

#### Objectif

Script one-shot qui relit le champ `tmdb_data` (jsonb) de tous les films matchés et peuple les tables normalisées.

#### Tâches

| Tâche | Statut |
|-------|--------|
| Script `scripts/backfill-tmdb-relations.ts` | ✅ |
| Relire `tmdb_data` pour chaque film avec `tmdb_match_status = 'matched'` | ✅ |
| Insérer `film_genres`, `film_people`, `film_companies` + upsert `tmdb_genres` | ✅ |
| Remplir `tagline` / `taglineEn` sur films | ✅ |
| Exécutable via `pnpm tsx scripts/backfill-tmdb-relations.ts` | ✅ |

---

### E14-004 — Fiche film enrichie
**Priorité** : P1 | **Taille** : M

#### Objectif

Afficher les données TMDB normalisées sur la fiche film exploitant.

#### Tâches

| Tâche | Statut |
|-------|--------|
| Section "Équipe" : réalisation, acteurs (avec personnage), producteurs, DOP, compositeur | ✅ |
| Section "Production" : sociétés de production | ✅ |
| Afficher tagline sous le titre | ✅ |
| Afficher note TMDB avec icône étoile | ✅ |
| Genres i18n : afficher dans la locale courante (nameEn / nameFr) | ✅ |
| Adapter la fiche film ayant droit (page `/films/[filmId]`) | ✅ |
| Tests E2E : vérifier sections équipe et production visibles | ✅ |
| Traductions en.json / fr.json pour les nouvelles sections | ✅ |

---

### E14-005 — Filtres catalogue avancés
**Priorité** : P1 | **Taille** : M

#### Objectif

Permettre aux exploitants de filtrer le catalogue par acteur, réalisateur et société de production via les tables normalisées.

#### Tâches

| Tâche | Statut |
|-------|--------|
| Facets `film_people` par rôle (director, actor) pour multi-select | ✅ |
| Facets `film_companies` pour multi-select | ✅ |
| Filtres SQL via JOIN sur `film_people` et `film_companies` | ✅ |
| Filtre genres via JOIN sur `film_genres` (remplace `@>` array) | ✅ |
| Genres dans les facets : labels i18n depuis `genres` | ✅ |
| UI : intégrer les nouveaux filtres dans le sidebar catalogue | ✅ |
| URL params : `actor`, `company` | ✅ |
| Tests unitaires catalog-service | ✅ |
| Tests E2E : filtrer par acteur, vérifier résultats | ✅ |

---

### E14-006 — Données manuelles → tables normalisées + genre sélecteur
**Priorité** : P0 | **Taille** : M

#### Contexte

Les tables normalisées (`film_genres`, `film_people`, `film_companies`) ne sont peuplées que par le flux TMDB. Les films ajoutés manuellement ou importés sans enrichissement TMDB ont leurs champs plats (`genres[]`, `directors[]`, `cast[]`) remplis mais pas les tables normalisées. Résultat : ces films sont **invisibles** dans les filtres avancés du catalogue.

De plus, les genres sont saisis en texte libre (comma-separated), alors qu'une taxonomie TMDB (`tmdb_genres`) existe avec des noms i18n.

#### Objectif

1. Peupler les tables normalisées à partir des données manuelles/CSV (pas seulement TMDB).
2. Remplacer le champ texte libre "Genres" par un sélecteur multi basé sur `tmdb_genres`.
3. Corriger `disassociateTmdbAction` qui laisse des orphelins dans les tables normalisées.

#### Tâches

| Tâche | Statut |
|-------|--------|
| Créer `syncNormalizedRelationsFromFlatFields()` dans film-service | ✅ |
| Appeler sync dans `updateTmdbManualAction` (édition manuelle) | ✅ |
| Appeler sync dans `importFilmsAction` quand autoEnrich=false | ✅ |
| Nettoyer les tables normalisées dans `disassociateTmdbAction` | ✅ |
| Créer action serveur pour lister les genres | ✅ |
| Remplacer le champ texte "Genres" par un multi-select `genres` dans film-form | ✅ |
| Stocker les genre IDs (pas les noms) dans `film_genres` pour les données manuelles | ✅ |
| Tests unitaires `matchGenreNamesToIds` + `syncNormalizedRelationsFromFlatFields` | ✅ |
| Typecheck + lint + tests existants passent | ✅ |

---

### E14-007 — Découplage genres TMDB → IDs internes
**Priorité** : P1 | **Taille** : M

#### Contexte

Les IDs de la table `tmdb_genres` étaient les IDs TMDB natifs (28 = Action, 18 = Drama, etc.). Ce couplage empêchait l'ajout d'autres sources de données (archives nationales, bases européennes, etc.).

#### Objectif

Créer des IDs internes séquentiels avec une colonne `tmdbId` pour le mapping TMDB, permettant d'ajouter des genres provenant d'autres sources dans le futur.

#### Tâches

| Tâche | Statut |
|-------|--------|
| Renommer table `tmdb_genres` → `genres` dans le schéma Drizzle | ✅ |
| Changer PK de `integer` (TMDB ID) à `serial` (auto-increment) | ✅ |
| Ajouter colonne `tmdbId` (integer, nullable, unique index) | ✅ |
| Créer fonction `resolveTmdbGenreIds()` pour mapper TMDB IDs → IDs internes | ✅ |
| Adapter `syncFilmTmdbRelations()` pour utiliser `resolveTmdbGenreIds()` | ✅ |
| Renommer `listTmdbGenres` → `listGenres`, `matchGenreNamesToTmdbIds` → `matchGenreNamesToIds` | ✅ |
| Renommer `getTmdbGenresAction` → `getGenresAction` dans les actions serveur | ✅ |
| Adapter `resyncTmdbAction` pour retourner les IDs internes au client | ✅ |
| Mettre à jour le catalog-service (imports, filtres, facets) | ✅ |
| Mettre à jour les pages film (fiche exploitant, fiche ayant droit) | ✅ |
| Adapter le script backfill pour utiliser le mapping `tmdbId` | ✅ |
| Migration Drizzle data-preserving (renommage + conversion IDs) | ✅ |
| Script migration exécutable (`scripts/migrate-genres.mjs`) | ✅ |
| Mettre à jour les tests unitaires | ✅ |
| Mettre à jour les tests E2E (`tmdb-enrichment.spec.ts`) | ✅ |
| Typecheck + lint + 453 tests passent | ✅ |

---

### E14-008 — Seeding genres depuis admin settings
**Priorité** : P1 | **Taille** : S

#### Objectif

Permettre à l'admin de vérifier et compléter la taxonomie des genres depuis la page settings, sans passer par un script CLI.

#### Tâches

| Tâche | Statut |
|-------|--------|
| Créer `seedMissingGenres()` dans film-service (upsert genres canoniques) | ✅ |
| Créer actions serveur `seedGenresAction` et `getGenresStatusAction` | ✅ |
| Créer composant `GenreSeedCard` dans admin settings | ✅ |
| Intégrer le card dans la page settings (fetch SSR du count) | ✅ |
| Traductions en.json / fr.json pour le bloc genres | ✅ |
| Typecheck + lint + tests passent | ✅ |

---

## Taxonomie genres (référence)

Les 19 genres avec IDs internes séquentiels et mapping TMDB :

| ID interne | TMDB ID | EN | FR |
|------------|---------|----|----|
| 1 | 12 | Adventure | Aventure |
| 2 | 14 | Fantasy | Fantastique |
| 3 | 16 | Animation | Animation |
| 4 | 18 | Drama | Drame |
| 5 | 27 | Horror | Horreur |
| 6 | 28 | Action | Action |
| 7 | 35 | Comedy | Comédie |
| 8 | 36 | History | Histoire |
| 9 | 37 | Western | Western |
| 10 | 53 | Thriller | Thriller |
| 11 | 80 | Crime | Crime |
| 12 | 99 | Documentary | Documentaire |
| 13 | 878 | Science Fiction | Science-Fiction |
| 14 | 9648 | Mystery | Mystère |
| 15 | 10402 | Music | Musique |
| 16 | 10749 | Romance | Romance |
| 17 | 10751 | Family | Familial |
| 18 | 10752 | War | Guerre |
| 19 | 10770 | TV Movie | Téléfilm |
