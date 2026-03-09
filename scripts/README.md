# Scripts TIMELESS

## generate-classic-films-excel.ts

Génère un fichier Excel avec plus de 100 films classiques depuis TMDB pour remplir la base de données avec des exemples réalistes.

### Usage

```bash
pnpm scripts:generate-films
```

### Prérequis

- Avoir `TMDB_ACCESS_TOKEN` ou `TMDB_API_KEY` configuré dans `.env.local`

### Fonctionnement

Le script :

1. **Récupère des films populaires** de différentes décennies (1950-2019) depuis l'API TMDB
2. **Enrichit chaque film** avec les détails complets (réalisateurs, casting, genres, etc.)
3. **Génère des zones de prix variées** (1 à 4 zones par film avec des devises différentes)
4. **Mix de types** : 70% achat direct (`direct`), 30% validation requise (`validation`)
5. **Mix de statuts** : 90% actifs (`active`), 10% inactifs (`inactive`)
6. **Génère un fichier Excel** dans `data/timeless-import-sample-{timestamp}.xlsx`

### Format du fichier généré

Le fichier Excel suit exactement le format attendu par l'interface d'import TIMELESS :

| Colonne       | Description                                      | Exemple                                    |
|---------------|--------------------------------------------------|--------------------------------------------|
| `Identifier`  | ID externe unique                                | `TMDB-278`                                 |
| `Title`       | Titre français (ou international)                | `Les Évadés`                               |
| `Type`        | `direct` ou `validation`                         | `direct`                                   |
| `Countries`   | Codes ISO séparés par virgule                    | `FR,BE,CH`                                 |
| `Price`       | Prix en unité monétaire (ex: 300 = 3€)          | `300`                                      |
| `Currency`    | Code ISO (EUR, USD, GBP, etc.)                   | `EUR`                                      |
| `Status`      | `active` ou `inactive`                           | `active`                                   |
| `Synopsis`    | Synopsis en français                             | `En 1947, Andy Dufresne...`                |
| `Synopsis_EN` | Synopsis en anglais                              | `In 1947, Andy Dufresne...`                |
| `Duration`    | Durée en minutes                                 | `142`                                      |
| `Release_Year`| Année de sortie                                  | `1994`                                     |
| `Genres`      | Genres (séparés par virgule)                     | `Drama,Crime`                              |
| `Directors`   | Réalisateurs (séparés par virgule)               | `Frank Darabont`                           |
| `Cast`        | Acteurs principaux (top 10, séparés par virgule) | `Tim Robbins,Morgan Freeman`               |
| `Poster_URL`  | URL du poster TMDB                               | `https://image.tmdb.org/t/p/w500/...`      |
| `Backdrop_URL`| URL du backdrop TMDB                             | `https://image.tmdb.org/t/p/w1280/...`     |

### Films multi-zones

Un même film peut apparaître sur **plusieurs lignes** pour différentes zones géographiques :

```
TMDB-278, Les Évadés, direct, FR,BE,CH, 250, EUR, active, ...
TMDB-278, Les Évadés, direct, US,CA,    350, USD, active, (vide)
TMDB-278, Les Évadés, direct, JP,       400, USD, active, (vide)
```

→ 1 film `Les Évadés` avec 3 zones de prix

Les lignes supplémentaires n'ont que les colonnes essentielles (Identifier, Title, Type, Countries, Price, Currency, Status), le reste est vide.

### Zones géographiques générées

Le script génère aléatoirement 1 à 4 zones de prix parmi :

- **Europe francophone** : FR, BE, CH (EUR)
- **Europe germanophone** : DE, AT (EUR)
- **Europe latine** : ES, PT (EUR) / IT (EUR)
- **Europe anglo-saxonne** : GB, IE (GBP)
- **Amérique du Nord** : US, CA (USD)
- **Asie-Pacifique** : JP (USD) / AU, NZ (USD)
- **Amérique Latine** : BR, AR, MX (USD)
- **Inde** : IN (USD)

### Import dans l'application

Une fois le fichier généré :

1. Connecte-toi en tant qu'ayant droit
2. Va dans **Films** → **Importer des films**
3. Upload le fichier Excel généré
4. Les colonnes sont auto-détectées (mapping automatique)
5. Vérifie la prévisualisation du diff
6. Confirme l'import

### Statistiques générées

Le script affiche un résumé après génération :

```
📊 Statistiques:
   • 84 films en achat direct
   • 36 films nécessitant validation
   • 108 films actifs
   • 12 films inactifs
```

### Limitations

- **Rate limit TMDB** : Le script respecte automatiquement les limites de l'API TMDB (40 requêtes/10 sec) avec des pauses entre les appels
- **Qualité minimale** : Seuls les films avec au moins 100 votes TMDB sont récupérés pour assurer une qualité minimale
- **Nombre de films** : Cible 120 films uniques (mais génère plus de lignes avec les zones multiples)

### Dépannage

**Erreur : TMDB_ACCESS_TOKEN non défini**
```bash
# Ajoute ta clé TMDB dans .env.local
TMDB_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiJ9...
# ou
TMDB_API_KEY=your_api_key_here
```

**Rate limit atteint**
```
Le script gère automatiquement les pauses. Si tu vois des erreurs 429,
augmente les valeurs sleep() dans le script.
```

**Pas assez de films récupérés**
```
Modifie le tableau `decades` dans le script pour ajouter plus de pages
ou élargir les plages de dates.
```
