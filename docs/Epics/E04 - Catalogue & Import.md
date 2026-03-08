# E04 — Catalogue & Import

**Phase** : P1
**Statut** : ⬜ A faire

---

## Contexte

Les ayants droits alimentent leur catalogue de deux façons :
1. **Import CSV / Excel** — pour les mises à jour en masse (priorité prototype)
2. **CRUD manuel** — pour ajouter/modifier un film à la main

À chaque création de film (manuelle ou import), la plateforme enrichit automatiquement les métadonnées via l'API TMDB. Un film peut ne pas avoir de correspondance TMDB (film d'archive, niche) — il reste créable avec juste le titre et les prix, la fiche sera moins complète.

Un film peut avoir des **prix différents selon les pays/zones**, avec des devises distinctes. Les prix sont stockés en **centimes** (ex. 150 EUR → 15000 en base).

---

## Ce qui existe déjà

| Composant | Statut | Détail |
|-----------|--------|--------|
| Schema DB `films` + `filmPrices` | ⚠️ Partiel | Enums, relations, `tmdbMatchStatus`, `importBatchId` — mais `externalId` manquant |
| Intégration TMDB | ✅ Complète | `enrichFilmFromTmdb()`, `searchFilms()`, `normalizeTmdbData()` dans `src/lib/tmdb/index.ts` |
| Traductions | ✅ Complètes | Toutes les clés films/catalogue définies dans `messages/*.json` |
| Page stub `/films` | ⚠️ Squelette | Titre uniquement, pas de contenu |
| Service film | ❌ Absent | `film-service.ts` à créer |
| Server actions | ❌ Absents | À créer dans `src/app/[locale]/(rights-holder)/films/` |
| Composants UI | ❌ Absents | À créer dans `src/components/films/` |
| API REST v1 `/films` | ❌ Absente | Routes + docs à créer |
| Lib CSV | ❌ Absente | `papaparse` à installer |
| Lib Excel | ❌ Absente | `xlsx` (SheetJS) à installer |

---

## Dépendances

- **E03** — Le compte ayant droit doit exister (créé en DB).
- **E05** — Le catalogue exploitant (lecture) consomme les films créés ici.
- **E07** — Le workflow de validation utilise le champ `type` (`direct` / `validation`).
- **E08** — Les prix catalogues (en centimes) sont utilisés pour le calcul du prix affiché.

---

## Hors scope E04

- Recherche et filtrage côté exploitant (→ E05)
- Workflow de validation des demandes (→ E07)
- Notifications email lors d'ajout de film (→ E12)
- Statistiques et analytics par film (→ E11)

---

## Modèle de données

### Schéma DB

```
films
  └── id (uuid, PK)
  └── accountId (uuid, FK accounts.id)
  └── externalId (text, nullable) ← identifiant propre à l'ayant droit (code catalogue, EAN, etc.)
  └── title, originalTitle
  └── status: active | inactive | retired
  └── type: direct | validation
  └── tmdbMatchStatus: matched | pending | no_match | manual
  └── tmdbData (jsonb)
  └── synopsis, duration, releaseYear, genres, directors, cast, posterUrl…
  └── importSource: manual | csv | excel
  └── importBatchId (text)

filmPrices (N par film)
  └── id (uuid, PK)
  └── filmId (uuid, FK films.id)
  └── countries (text[])  ← ex. ["FR", "BE", "CH"]
  └── price (integer, centimes)  ← ex. 15000 = 150.00 EUR
  └── currency (text)  ← code ISO ex. "EUR", "USD"
```

### Contrainte d'unicité

- `(accountId, externalId)` — un seul film par ayant droit pour un identifiant donné
- Cette contrainte ne s'applique que si `externalId IS NOT NULL` (les films créés manuellement sans identifiant n'y sont pas soumis)
- Un pays ne peut apparaître que dans **une seule** zone de prix par film

### Migration nécessaire

Ajouter le champ `externalId` à la table `films` :
```sql
ALTER TABLE films ADD COLUMN external_id text;
CREATE UNIQUE INDEX films_account_external_id_idx ON films (account_id, external_id) WHERE external_id IS NOT NULL;
```

---

## Infrastructure commune (pré-requis transverse)

> Ces tâches sont nécessaires avant ou pendant les tickets. Elles ne sont rattachées à aucun ticket en particulier.

| Tâche | Statut |
|-------|--------|
| Ajouter colonne `external_id` + index unique conditionnel sur `films` (migration Drizzle) | ⬜ |
| Créer `src/lib/services/film-service.ts` : `listFilmsForAccount`, `getFilm`, `createFilm`, `updateFilm`, `archiveFilm` | ⬜ |
| Créer page liste `/films` (squelette → liste réelle avec pagination) | ⬜ |
| Créer route `/films/new` (création manuelle) | ⬜ |
| Créer route `/films/[filmId]` (fiche détail / édition) | ⬜ |
| Créer route `/films/import` (import CSV / Excel) | ⬜ |

---

## Tickets

---

### E04-001 — Import CSV / Excel (sync catalogue)
**Priorité** : P0 | **Taille** : L

#### Tâches de développement

| Tâche | Statut |
|-------|--------|
| Installer `papaparse` + `@types/papaparse` et `xlsx` (SheetJS) | ⬜ |
| Créer `src/lib/services/film-import-service.ts` : parsing, regroupement par clé, calcul du diff | ⬜ |
| Parser CSV côté client (`papaparse`) avec détection de l'encodage | ⬜ |
| Parser Excel côté client (`xlsx`) avec extraction de la première feuille | ⬜ |
| Composant "étape 1 — Upload" : drag & drop + sélecteur, limite 10 Mo / 500 lignes | ⬜ |
| Composant "étape 2 — Mapping" : colonnes auto-détectées, correctives, désignation identifiant unique | ⬜ |
| Composant "étape 3 — Prévisualisation" : diff créations ✅ / mises à jour 🔄 / archivages ⚠️ / erreurs ❌ | ⬜ |
| Composant "étape 4 — Confirmation" : liste des archivages + input `CONFIRMER` si films à archiver | ⬜ |
| Server action `importFilms(payload)` : sync complète (create / update / archive) dans une transaction | ⬜ |
| Générer `importBatchId` (uuid) à la création des films | ⬜ |
| Route handler `POST /api/internal/enrich-batch/[batchId]` : enrichissement TMDB séquentiel | ⬜ |
| Appel fire-and-forget vers `/api/internal/enrich-batch/[batchId]` depuis le server action | ⬜ |
| Templates téléchargeables : fichiers CSV et Excel pré-formatés avec exemple | ⬜ |
| Rapport post-import : X créés / Y mis à jour / Z archivés / W erreurs | ⬜ |

#### Description
Un ayant droit peut importer son catalogue en masse via un fichier CSV ou Excel (`.xlsx`).

L'import est une **synchronisation complète** du catalogue : le fichier représente l'état cible du catalogue de l'ayant droit. Les films absents du fichier mais présents en base sont **archivés automatiquement**.

#### Format du fichier

| Colonne | Requis | Valeurs acceptées | Exemple |
|---------|--------|---------|---------|
| Identifiant | ➖ | Texte libre — code catalogue, EAN, etc. | `CLV-042` |
| Titre | ✅ | Texte libre | `Cléo de 5 à 7` |
| Type | ✅ | `direct` ou `validation` | `direct` |
| Pays | ✅ | Codes ISO séparés par espace ou virgule | `FR BE CH` |
| Prix | ✅ | Entier en unité monétaire (converti en centimes côté serveur) | `150` |
| Devise | ✅ | Code ISO Stripe-compatible | `EUR` |
| Statut | ➖ | `active` / `inactive` | `active` (défaut) |

Un même film peut avoir **plusieurs lignes** pour des zones/devises différentes. Ces lignes sont regroupées en un seul film avec plusieurs zones de prix :
```
CLV-001, Cléo de 5 à 7, direct, FR BE CH, 150, EUR
CLV-001, Cléo de 5 à 7, direct, US CA,    200, USD
CLV-001, Cléo de 5 à 7, direct, JP KR,    180, USD
```
→ 1 film `Cléo de 5 à 7` + 3 `filmPrices`

#### Template

Un template CSV et un template Excel sont téléchargeables depuis la page d'import avec les colonnes pré-formatées et un exemple.

#### Parsing

- **CSV** : `papaparse` (client-side)
- **Excel (.xlsx)** : `xlsx` (SheetJS, client-side)
- Limite : **500 lignes** / **10 Mo** max

#### Étape de mapping des colonnes

Après upload du fichier, une étape de **mapping** est affichée avant la prévisualisation :
- Le système tente une détection automatique des colonnes par correspondance de nom (tolérant : `titre`, `title`, `Titre`, `TITLE` → mappé automatiquement)
- L'utilisateur peut corriger les associations colonne → champ via des sélecteurs
- **Identifiant unique** : champ optionnel mais recommandé — l'utilisateur désigne quelle colonne sert d'identifiant unique
- Si aucun identifiant mappé : la déduplication se fait par titre normalisé (trim + lowercase) — comportement de fallback
- Une prévisualisation live (aperçu des 3 premières lignes parsées) est affichée pendant le mapping

#### Clé d'unicité et regroupement

La déduplication est **propre à chaque compte** (deux accounts différents peuvent avoir le même film).

Clé d'unicité :
- Avec identifiant mappé : `(accountId, externalId)`
- Sans identifiant mappé : `(accountId, normalize(title))` — fallback

Regroupement des lignes :
1. Les lignes partageant la même clé → regroupées en 1 film
2. Chaque ligne du groupe → 1 zone de prix (`filmPrice`)
3. Un pays ne peut apparaître que dans une seule zone du groupe (erreur sinon)

#### Logique de synchronisation (diff)

L'import calcule un diff entre le fichier et la base de données de l'account :

| Situation | Action |
|-----------|--------|
| Film dans le fichier + absent en base | **Création** + enrichissement TMDB asynchrone |
| Film dans le fichier + présent en base | **Mise à jour** des données film + **remplacement complet** des prix (DELETE + INSERT) |
| Film absent du fichier + présent en base (`active` ou `inactive`) | **Archivage** → statut `retired` (irréversible) |
| Film absent du fichier + déjà `retired` | Ignoré (aucune action) |
| Film avec erreurs dans le fichier | **Ignoré** pour la synchronisation (ni mis à jour ni archivé) |

> ⚠️ **L'archivage est irréversible**. Les films archivés restent en base pour conserver l'historique des commandes et demandes passées, mais disparaissent du catalogue.

#### Étape de confirmation (avant exécution)

Avant d'exécuter l'import, un écran de confirmation affiche le diff complet :
- ✅ **X films à créer**
- 🔄 **Y films à mettre à jour**
- ⚠️ **Z films à archiver** — liste des titres concernés avec avertissement "Cette action est irréversible"
- ❌ **W lignes en erreur** — ignorées

L'ayant droit doit confirmer explicitement avant exécution. Si des films doivent être archivés, la confirmation demande de saisir `CONFIRMER` pour valider.

#### Enrichissement TMDB asynchrone

- Déclenché pour **tous** les films nouvellement créés
- Les films mis à jour conservent leurs données TMDB existantes (pas de re-fetch automatique)
- Les films créés apparaissent immédiatement en liste avec le badge `pending`
- Traitement en arrière-plan via route handler interne `POST /api/internal/enrich-batch/[batchId]`
- Traitement **séquentiel** (1 film à la fois) pour respecter les rate limits TMDB
- Résultat : `tmdbMatchStatus` mis à jour vers `matched`, `no_match`, ou reste `pending` en cas d'erreur TMDB

#### Flow UI

1. Upload du fichier (drag & drop ou sélecteur — CSV ou Excel)
2. **Mapping des colonnes** : correspondances auto-détectées, corrigeables, désignation de l'identifiant unique
3. Parsing client-side + calcul du diff → prévisualisation (créations ✅, mises à jour 🔄, archivages ⚠️, erreurs ❌)
4. **Confirmation** avec liste des archivages à venir (saisie de `CONFIRMER` si films à archiver)
5. Sync envoyée au serveur → rapport : X créés, Y mis à jour, Z archivés, W erreurs
6. Enrichissement TMDB lancé en arrière-plan pour les films créés

#### Critères d'acceptation

- [ ] CSV et Excel (`.xlsx`) sont acceptés
- [ ] Un template CSV et Excel sont téléchargeables
- [ ] L'étape de mapping des colonnes est affichée après upload avec auto-détection
- [ ] L'utilisateur peut désigner la colonne "identifiant unique" pendant le mapping
- [ ] Le fichier est parsé côté client et prévisualisé avant import avec le diff complet
- [ ] Les lignes d'un même film (même identifiant) sont regroupées en 1 film + N zones de prix
- [ ] Films dans le fichier mais absents en base → créés
- [ ] Films dans le fichier et présents en base → mis à jour (données + remplacement complet des prix)
- [ ] Films absents du fichier et présents en base → archivés (`retired`)
- [ ] Films avec erreurs → ignorés (ni mis à jour, ni archivés)
- [ ] La confirmation affiche la liste des films à archiver avec avertissement irréversible
- [ ] Si des films sont à archiver, la confirmation demande de saisir `CONFIRMER`
- [ ] Les prix sont convertis en centimes à l'ingestion
- [ ] L'enrichissement TMDB est lancé en arrière-plan pour les nouveaux films
- [ ] Les nouveaux films apparaissent immédiatement avec le badge `pending`
- [ ] Un rapport post-import affiche le nombre de créations / mises à jour / archivages / erreurs
- [ ] Fichiers > 500 lignes ou > 10 Mo sont rejetés avec un message clair

---

### E04-002 — Validation et détection d'erreurs à l'import
**Priorité** : P0 | **Taille** : M

#### Tâches de développement

| Tâche | Statut |
|-------|--------|
| Implémenter les règles d'erreurs bloquantes dans `film-import-service.ts` (titre vide, type invalide, pays vide, prix invalide, devise inconnue, pays en double) | ⬜ |
| Implémenter les warnings (statut absent → défaut, codes pays partiellement invalides, doublons de zone → dernier gagne) | ⬜ |
| Afficher les erreurs avec numéro de ligne et nom de colonne dans la prévisualisation | ⬜ |
| Re-validation serveur complète dans le server action `importFilms` (double sécurité) | ⬜ |

#### Description
Règles de validation appliquées pendant le parsing client-side et re-vérifiées côté serveur.

#### Erreurs bloquantes (ligne rejetée)

- Colonne `titre` vide
- Colonne `type` absente ou valeur invalide (ni `direct` ni `validation`)
- Colonne `pays` vide ou tous les codes pays invalides
- `prix` non numérique, négatif, ou zéro
- `devise` non reconnue (pas dans la liste ISO Stripe-compatible — voir `src/lib/currencies.ts`)
- Un pays apparaît dans deux zones différentes pour le même film (dans le même fichier)

#### Warnings (ligne importée malgré tout)

- `statut` absent → défaut `active` appliqué
- Certains codes pays invalides dans une liste mixte (les valides sont conservés)
- Doublons de zone pour un même film dans le fichier (deux lignes avec les mêmes pays et même devise → la dernière gagne)

#### Critères d'acceptation

- [ ] Les erreurs bloquantes empêchent l'import de la ligne concernée
- [ ] Les warnings sont affichés mais n'empêchent pas l'import
- [ ] La colonne et la ligne de chaque erreur sont indiquées précisément
- [ ] La validation serveur rejette également les données invalides (double sécurité)

---

### E04-003 — Création manuelle d'un film
**Priorité** : P0 | **Taille** : M

#### Tâches de développement

| Tâche | Statut |
|-------|--------|
| Composant `FilmForm` : champs titre, identifiant externe, type, statut | ⬜ |
| Composant de recherche TMDB en temps réel : debounce 300ms, affichage des 5 premiers résultats (titre, année, affiche) | ⬜ |
| Gestion des 3 cas TMDB : sélection → enrichissement synchrone, "Aucune correspondance" → `no_match`, TMDB indisponible → `pending` + toast | ⬜ |
| Sous-formulaire zones de prix (intégré dans `FilmForm`) : add / remove dynamique | ⬜ |
| Server action `createFilm(input)` : validation Zod, appel `film-service.ts`, enrichissement TMDB synchrone si résultat sélectionné | ⬜ |
| Page `/films/new` avec `FilmForm` et feedback toast | ⬜ |

#### Description
Un ayant droit peut ajouter un film manuellement via un formulaire.

#### Formulaire

| Champ | Requis | Détail |
|-------|--------|--------|
| Titre | ✅ | Déclenche une recherche TMDB en temps réel (debounce 300ms) |
| Identifiant externe | ➖ | Code catalogue propre à l'ayant droit (ex. `CLV-042`). Utilisé pour la déduplication lors d'un re-import. Si renseigné, un re-import écrasera les données du film si cet identifiant est trouvé dans le fichier. |
| Résultat TMDB | ➖ | Sélection parmi les résultats — si ignoré ou "Aucune correspondance", `tmdbMatchStatus = "no_match"`, pas d'enrichissement |
| Type | ✅ | `direct` ou `validation` |
| Statut | ✅ | `active` / `inactive` (défaut : `active`) |
| Zones de prix | ✅ | Au moins une zone requise (pays + prix + devise) |

#### Recherche TMDB

- Utilise `searchFilms()` de `src/lib/tmdb/index.ts`
- Affiche les 5 premiers résultats avec titre, année, affiche
- Si l'ayant droit sélectionne un résultat → enrichissement complet **synchrone** au moment de la sauvegarde (`enrichFilmFromTmdb()`)
- Si l'ayant droit choisit "Aucune correspondance" **ou ignore la recherche** → `tmdbMatchStatus = "no_match"`, aucun enrichissement tenté, la fiche reste moins complète (comportement attendu)

#### Si TMDB indisponible

- Si un résultat a été sélectionné mais TMDB répond en erreur → film créé avec `tmdbMatchStatus = "pending"`, toast d'avertissement ("Les données TMDB n'ont pas pu être récupérées, vous pouvez relancer l'enrichissement ultérieurement")

#### Critères d'acceptation

- [ ] La recherche TMDB est déclenchée automatiquement en temps réel lors de la saisie du titre
- [ ] L'ayant droit peut créer un film sans interagir avec TMDB (`tmdbMatchStatus = "no_match"`)
- [ ] Au moins une zone de prix est requise à la création
- [ ] Si un résultat TMDB est sélectionné, l'enrichissement est effectué synchroniquement à la sauvegarde
- [ ] Si TMDB est indisponible après sélection, la création réussit avec `tmdbMatchStatus = "pending"`

---

### E04-004 — Édition et suppression d'un film
**Priorité** : P0 | **Taille** : S

#### Tâches de développement

| Tâche | Statut |
|-------|--------|
| Server action `updateFilm(filmId, input)` : validation Zod, vérification ownership, mise à jour des champs + remplacement complet des zones de prix | ⬜ |
| Server action `archiveFilm(filmId)` : passage à `retired`, vérification ownership, blocage si déjà `retired` | ⬜ |
| Page `/films/[filmId]` : chargement de la fiche, `FilmForm` pré-rempli en mode édition | ⬜ |
| Dialog de confirmation d'archivage (irréversible) | ⬜ |

#### Description
Un ayant droit peut modifier ou archiver un film depuis sa fiche détail.

#### Édition

- Tous les champs du formulaire de création sont modifiables
- Les zones de prix sont modifiables (ajout, modification, suppression d'une zone)
- La modification du titre ne déclenche **pas** un re-fetch TMDB automatique (action manuelle — voir E04-006)

#### Suppression (soft delete)

- Action : passer le statut à `retired`
- Un film `retired` est masqué du catalogue exploitant et de la liste ayant droit
- **Irréversible** : un film `retired` ne peut pas revenir à `active` ou `inactive`
- Les données sont conservées pour l'historique des commandes existantes

#### Critères d'acceptation

- [ ] Tous les champs sont modifiables depuis la fiche film
- [ ] Les zones de prix peuvent être ajoutées, modifiées et supprimées
- [ ] L'archivage (→ `retired`) est irréversible et demande une confirmation explicite
- [ ] Un film `retired` n'apparaît plus dans la liste ni dans le catalogue exploitant
- [ ] Les commandes passées sur un film `retired` restent accessibles dans l'historique

---

### E04-005 — Enrichissement automatique TMDB
**Priorité** : P1 | **Taille** : M

#### Tâches de développement

| Tâche | Statut |
|-------|--------|
| Intégrer `enrichFilmFromTmdb()` dans le server action `createFilm` (chemin synchrone) | ⬜ |
| Implémenter `POST /api/internal/enrich-batch/[batchId]` : récupérer films `pending` du batch, traitement séquentiel, mise à jour `tmdbMatchStatus` + `tmdbData` | ⬜ |
| Gérer l'erreur TMDB par film dans le batch : reste `pending`, passe au suivant | ⬜ |
| Badges `tmdbMatchStatus` sur la liste des films : `pending` orange / `no_match` gris / `manual` bleu | ⬜ |

> L'intégration TMDB est **déjà codée** dans `src/lib/tmdb/index.ts`. Ce ticket concerne uniquement l'intégration dans les flows de création/import.

#### Données récupérées et stockées

- Synopsis FR + EN
- Durée (en minutes)
- Année de sortie
- Genre(s)
- Réalisateur(s)
- Distribution (top 10 acteurs)
- Pays d'origine
- Poster URL + Backdrop URL
- Note TMDB

#### Stratégie de matching (existante dans `enrichFilmFromTmdb()`)

- Recherche par titre + année si disponible
- Score de confiance basé sur similarité du titre
- Si match confident → `tmdbMatchStatus = "matched"`
- Si match incertain → `tmdbMatchStatus = "pending"`, flagué pour review manuelle
- Si aucun résultat → `tmdbMatchStatus = "no_match"`

#### Comportement par mode de création

| Mode | Comportement |
|------|-------------|
| Création manuelle (résultat TMDB sélectionné) | **Synchrone** — attend la réponse TMDB avant de confirmer la création |
| Création manuelle (pas de sélection TMDB) | Aucun enrichissement — `tmdbMatchStatus = "no_match"` |
| Import CSV / Excel | **Asynchrone** — films créés immédiatement avec `tmdbMatchStatus = "pending"`, enrichissement en arrière-plan via route handler interne, traitement **séquentiel** (1 film/appel, rate limits TMDB) |

#### Implémentation de l'enrichissement asynchrone (import)

1. Import crée les films avec `tmdbMatchStatus = "pending"` et `importBatchId = uuid`
2. Import retourne le rapport à l'utilisateur (X créés, Y mis à jour, Z erreurs)
3. Appel fire-and-forget vers `POST /api/internal/enrich-batch/[batchId]`
4. Le route handler récupère tous les films du batch avec `tmdbMatchStatus = "pending"`
5. Traitement séquentiel : `enrichFilmFromTmdb(title, year)` → update `tmdbMatchStatus` + `tmdbData`
6. En cas d'erreur TMDB sur un film : reste `pending`, on passe au suivant
7. L'utilisateur voit les badges se mettre à jour à chaque navigation (server components)

#### Badge visuel sur la liste

- `matched` → aucun badge
- `pending` → badge orange "Enrichissement en cours"
- `no_match` → badge gris "Sans données TMDB"
- `manual` → badge bleu "Données manuelles"

#### Critères d'acceptation

- [ ] À la création manuelle avec sélection TMDB, les données TMDB sont peuplées synchroniquement
- [ ] À l'import, les films apparaissent immédiatement avec le badge "Enrichissement en cours" (`pending`)
- [ ] L'enrichissement asynchrone met à jour `tmdbMatchStatus` pour tous les films du batch
- [ ] Le badge de statut TMDB est visible sur la liste de films
- [ ] Si TMDB est indisponible pour un film lors du batch, ce film reste `pending` et l'enrichissement continue pour les suivants

---

### E04-006 — Correction manuelle des données TMDB
**Priorité** : P2 | **Taille** : M

#### Tâches de développement

| Tâche | Statut |
|-------|--------|
| Section "Données TMDB" en lecture sur la fiche film : synopsis, affiche, cast, genres… | ⬜ |
| Mode édition des champs TMDB : mise à jour `tmdbData` + passage à `tmdbMatchStatus = "manual"` | ⬜ |
| Server action `resyncTmdb(filmId)` : re-fetch complet, écrase `tmdbData`, repasse à `matched` ou `no_match` | ⬜ |
| Server action `disassociateTmdb(filmId)` : `tmdbMatchStatus = "no_match"`, efface `tmdbData` | ⬜ |
| Boutons "Resynchroniser avec TMDB" et "Supprimer la correspondance" avec confirmations | ⬜ |

#### Description
Un ayant droit peut corriger manuellement les données TMDB depuis la fiche film.

#### Fonctionnalités

- Affichage des données TMDB actuelles sur la fiche film (synopsis, affiche, cast…)
- Modification manuelle de n'importe quel champ TMDB → `tmdbMatchStatus = "manual"`
- Re-fetch TMDB manuel (bouton "Resynchroniser avec TMDB") → écrase les données actuelles
- Désassociation TMDB (bouton "Supprimer la correspondance TMDB") → `tmdbMatchStatus = "no_match"`, données TMDB effacées

#### Critères d'acceptation

- [ ] Les données TMDB sont affichées en lecture sur la fiche film
- [ ] L'ayant droit peut modifier manuellement les champs TMDB
- [ ] Le bouton "Resynchroniser" relance un enrichissement TMDB complet
- [ ] La désassociation passe `tmdbMatchStatus` à `"no_match"` et efface les données TMDB

---

### E04-007 — Gestion des prix multi-zones
**Priorité** : P0 | **Taille** : M

#### Tâches de développement

| Tâche | Statut |
|-------|--------|
| Composant `PriceZonesEditor` : tableau éditable avec colonnes pays (multi-select + recherche), prix, devise | ⬜ |
| Ajout de zone (bouton + ligne vide ou modale) | ⬜ |
| Modification inline d'une zone | ⬜ |
| Suppression d'une zone avec confirmation | ⬜ |
| Validation : un pays ne peut pas apparaître dans deux zones (client + serveur) | ⬜ |
| Conversion centimes ↔ unité monétaire à l'affichage et à l'enregistrement | ⬜ |

#### Description
Interface de gestion des zones de prix sur la fiche film.

#### Modèle

- Une zone = `{ pays: string[], prix: integer (centimes), devise: string }`
- Un film peut avoir N zones
- Un pays ne peut apparaître que dans une seule zone (validation à l'enregistrement)

#### UI (tableau éditable)

- Tableau des zones avec colonnes : pays (multi-select avec recherche), prix (affiché en unité monétaire), devise
- Bouton "Ajouter une zone"
- Modification inline ou via modale
- Suppression d'une zone avec confirmation

#### Saisie des prix

- L'ayant droit saisit le prix en unités monétaires (ex. "150")
- Converti en centimes à l'enregistrement (150 → 15000)
- Affiché en unités monétaires dans toute l'interface

#### Film sans zone pour un pays donné

- Le film est **masqué** dans le catalogue exploitant pour les cinémas de ce pays
- *(Pas de "tarif sur demande" pour l'instant — à réévaluer en E05)*

#### Critères d'acceptation

- [ ] Un film peut avoir plusieurs zones de prix avec devises différentes
- [ ] Un pays ne peut pas apparaître dans deux zones différentes (erreur de validation)
- [ ] Les prix sont saisis en unités monétaires et stockés en centimes
- [ ] Un film sans zone pour un pays donné est masqué pour les cinémas de ce pays
- [ ] Les zones peuvent être ajoutées, modifiées et supprimées depuis la fiche film

---

### E04-008 — Statut et visibilité d'un film
**Priorité** : P0 | **Taille** : S

#### Tâches de développement

| Tâche | Statut |
|-------|--------|
| Logique de transition dans `film-service.ts` : `active ↔ inactive`, `active/inactive → retired` (irréversible), bloquer `retired → *` | ⬜ |
| Server action `setFilmStatus(filmId, status)` | ⬜ |
| Action rapide de bascule `active/inactive` depuis la liste des films (toggle ou dropdown) | ⬜ |
| Changement de statut depuis la fiche film | ⬜ |
| Dialog de confirmation pour le passage à `retired` ("Cette action est irréversible") | ⬜ |
| Filtrage des films `retired` dans `listFilmsForAccount` (exclus par défaut) | ⬜ |

#### Description
Gestion des transitions de statut d'un film.

#### États et visibilité

| Statut | Catalogue exploitant | Liste ayant droit | Modifiable |
|--------|---------------------|-------------------|------------|
| `active` | ✅ Visible | ✅ Visible | ✅ Oui |
| `inactive` | ❌ Masqué | ✅ Visible | ✅ Oui |
| `retired` | ❌ Masqué | ❌ Masqué | ❌ Non |

#### Transitions autorisées

- `active` ↔ `inactive` (bidirectionnel)
- `active` → `retired` (irréversible)
- `inactive` → `retired` (irréversible)
- `retired` → tout autre statut (**interdit**)

#### UI

- Changement de statut depuis la liste (action rapide) et depuis la fiche film
- La transition vers `retired` demande une confirmation explicite ("Cette action est irréversible")

#### Critères d'acceptation

- [ ] Un film `inactive` est masqué du catalogue exploitant mais visible dans la liste ayant droit
- [ ] Un film `retired` est masqué partout
- [ ] Le passage à `retired` demande une confirmation et est irréversible
- [ ] Le changement de statut est accessible depuis la liste ET depuis la fiche film

---

## API REST v1

### Tâches de développement API

| Tâche | Statut |
|-------|--------|
| `GET /api/v1/films` — liste paginée (auth Bearer) | ⬜ |
| `POST /api/v1/films` — création d'un film | ⬜ |
| `GET /api/v1/films/[filmId]` — détail | ⬜ |
| `PATCH /api/v1/films/[filmId]` — mise à jour | ⬜ |
| `DELETE /api/v1/films/[filmId]` — archivage (`retired`) | ⬜ |
| `GET /api/v1/films/[filmId]/prices` — liste des zones | ⬜ |
| `POST /api/v1/films/[filmId]/prices` — création d'une zone | ⬜ |
| `PATCH /api/v1/films/[filmId]/prices/[priceId]` — modification | ⬜ |
| `DELETE /api/v1/films/[filmId]/prices/[priceId]` — suppression | ⬜ |
| Créer `docs/api/v1/films.md` | ⬜ |



Routes à créer sous `/api/v1/films/` (pattern identique à `/api/v1/cinemas/`) :

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/api/v1/films` | Liste les films du compte (pagination) |
| `POST` | `/api/v1/films` | Crée un film |
| `GET` | `/api/v1/films/[filmId]` | Détail d'un film |
| `PATCH` | `/api/v1/films/[filmId]` | Met à jour un film |
| `DELETE` | `/api/v1/films/[filmId]` | Archive un film (→ `retired`) |
| `GET` | `/api/v1/films/[filmId]/prices` | Liste les zones de prix |
| `POST` | `/api/v1/films/[filmId]/prices` | Crée une zone de prix |
| `PATCH` | `/api/v1/films/[filmId]/prices/[priceId]` | Modifie une zone |
| `DELETE` | `/api/v1/films/[filmId]/prices/[priceId]` | Supprime une zone |

Documentation à créer dans `docs/api/v1/films.md`.

---

## Tests

### Tâches de développement tests

| Tâche | Statut |
|-------|--------|
| `film-service.test.ts` : listFilmsForAccount, createFilm (avec / sans zone), updateFilm (ownership), archiveFilm (irréversible), pays en double | ⬜ |
| `film-import-service.test.ts` : parsing CSV/Excel, regroupement par externalId, diff create/update/archive, cas bord (retired ignoré, erreurs ignorées, fallback titre normalisé) | ⬜ |
| `tmdb/index.test.ts` : normalizeTmdbData (directeurs, cast limité), enrichFilmFromTmdb (titre inconnu → null) | ⬜ |
| E2E `films-crud.spec.ts` : création manuelle, recherche TMDB, édition, archivage, disparition de la liste | ⬜ |
| E2E `films-import.spec.ts` : mapping, auto-détection, diff, CSV et Excel, regroupement, confirmation CONFIRMER, badge pending | ⬜ |
| E2E `films-pricing.spec.ts` : multi-zones, pays en double (client + serveur), centimes vs affichage | ⬜ |

### Tests unitaires (Vitest)

**`src/lib/services/__tests__/film-service.test.ts`** :
- `listFilmsForAccount(accountId)` retourne uniquement les films du compte
- `createFilm()` sans zone de prix → erreur `INVALID_INPUT`
- `createFilm()` avec zone de prix valide → film créé avec statut `active`
- `updateFilm()` par un account qui ne possède pas le film → erreur `FORBIDDEN`
- `archiveFilm()` → statut passe à `retired`, irréversible (nouvelle tentative → erreur)
- Un pays dans deux zones différentes → erreur de validation

**`src/lib/services/__tests__/film-import-service.test.ts`** :
- Ligne CSV valide → parsée correctement (prix converti en centimes)
- Ligne avec `prix` non numérique → erreur bloquante
- Ligne avec `devise` inconnue → erreur bloquante
- Ligne avec `statut` absent → défaut `active` appliqué
- Deux lignes avec le même `externalId` → regroupées en 1 film + 2 zones de prix
- Film dans fichier + absent en base → créé
- Film dans fichier + présent en base → mis à jour + remplacement complet des prix
- Film absent du fichier + présent en base (`active`) → archivé (`retired`)
- Film absent du fichier + déjà `retired` → ignoré (pas de double archivage)
- Film avec erreurs dans le fichier → ignoré pour la sync (ni mis à jour ni archivé)
- Doublon sans externalId → titre normalisé comme clé de fallback
- Un pays dans deux zones du même film dans le fichier → erreur bloquante

**`src/lib/tmdb/index.test.ts`** (si non existant) :
- `normalizeTmdbData()` extrait correctement les directeurs (filtrage crew)
- `normalizeTmdbData()` limite le cast à 10 acteurs
- `enrichFilmFromTmdb()` avec titre inconnu → retourne `null`

---

### Tests E2E (Playwright)

**`e2e/films-crud.spec.ts`**
- Un rights_holder peut créer un film manuellement avec titre + type + prix
- La recherche TMDB s'affiche lors de la saisie du titre
- Un film peut être créé sans interaction avec TMDB (`tmdbMatchStatus = "no_match"`)
- Un film peut être édité (titre, statut, zones de prix)
- Le passage à `retired` demande une confirmation
- Un film `retired` disparaît de la liste

**`e2e/films-import.spec.ts`**
- L'étape de mapping des colonnes s'affiche après upload
- L'auto-détection des colonnes fonctionne pour les noms standards
- Un CSV valide est parsé et la prévisualisation du diff s'affiche (créations / mises à jour / archivages)
- Un Excel (`.xlsx`) valide est parsé et la prévisualisation du diff s'affiche
- Les lignes d'un même film (même externalId) sont regroupées en un seul film
- Les erreurs de validation sont visibles dans la prévisualisation
- Si des films sont à archiver, la confirmation demande de saisir `CONFIRMER`
- Films absents du fichier + présents en base → archivés après confirmation
- Un fichier > 500 lignes est rejeté
- Après import, les nouveaux films apparaissent avec le badge `pending`

**`e2e/films-pricing.spec.ts`**
- Un ayant droit peut ajouter plusieurs zones de prix
- Un pays ne peut pas être dans deux zones (validation côté client et serveur)
- Les prix sont affichés en euros, stockés en centimes

---

## Points ouverts

*Aucun point ouvert.*
