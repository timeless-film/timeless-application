# E05 — Recherche & Catalogue

**Phase** : P1

---

## Contexte

La page catalogue est la page principale pour les exploitants. Elle doit permettre de parcourir et filtrer les films disponibles, avec des prix cohérents selon les territoires des cinémas de l'exploitant.

Cet epic couvre aussi :
- la fiche film détaillée côté exploitant ;
- l'affichage indicatif en devise préférée ;
- la vue analytics côté ayants droit (`/films/analytics`).

---

## Décisions Produit Verrouillées

1. Prix catalogue: afficher un prix par zone compatible avec les cinémas de l'exploitant.
2. Si une seule zone matche: afficher un seul prix.
3. Film sans prix compatible: visible mais non achetable (`Indisponible pour vos cinémas`).
4. Filtre disponibilité territoire: activé par défaut.
5. Recherche: PostgreSQL `ILIKE` en P0.
6. Filtres: persistés dans l'URL + dernière configuration sauvegardée côté utilisateur.
7. Pagination: serveur uniquement.
8. Filtres UX: sliders (année, durée) + multi-select (genre, ayant droit, etc.).
9. Tri par défaut: titre A-Z.
10. Vue catalogue par défaut: grille inspirante et conversion-oriented.
11. Fiche film: page dédiée, ouverte dans un nouvel onglet depuis le catalogue.
12. Favoris: hors scope.
13. Prix affichés: HT.
14. Devise secondaire: `preferredCurrency` du compte exploitant.
15. Taux de change: Frankfurter + cache 1h.
16. Modale obligatoire pour `Ajouter au panier` et `Faire une demande`.
17. Visibilité: tous les films `active` sont visibles.
18. Disponibilité géographique: pilotée uniquement par zones de prix.
19. Cible usage: desktop-first, responsive complet.
20. Tracking: recherches, filtres, vues film, ajouts panier, demandes.
21. Fallback devise si `preferredCurrency` manquante/invalide: `EUR`.
22. Multi-select en URL: format répété (`genres=drama&genres=comedy`) via `URLSearchParams`.
23. `limit` pagination borné côté serveur à `100` max.
24. Ouverture fiche film: nouvel onglet systématique.
25. `quantity`: minimum `1`, pas de maximum fonctionnel.
26. Modales: total dynamique et changement de devise d'affichage directement dans la modale.
27. Modales: informer si article identique déjà au panier ou si demande en cours pour ce film.
28. Tracking vue film: déclenché après seuil d'engagement (5 secondes).

---

## Règles Métier Clés

- Un film est disponible si au moins une zone de prix contient le pays d'au moins un cinéma actif de l'exploitant.
- Un film peut afficher plusieurs lignes de prix si plusieurs zones matchent.
- Le type `direct` ouvre un flux panier.
- Le type `validation` ouvre un flux demande.
- Le montant converti en devise préférée est indicatif uniquement.
- Le paiement final reste dans la devise native du prix.
- Le prix natif est toujours la référence métier, y compris dans les modales.
- Le changement de devise dans la modale est un affichage utilisateur, jamais une modification de devise de transaction.

---

## Suivi d'Avancement Tickets

| Ticket | Statut | Attendus de suivi |
|---|---|---|
| E05-001 | ⬜ A faire | Backend filtres + pagination serveur + URL state, UI grille/liste, tests unit/API/E2E passants |
| E05-002 | ⬜ A faire | Fiche film + ouverture nouvel onglet + modales unifiées + garde-fous doublons + tests passants |
| E05-003 | ⬜ A faire | Service taux FX Frankfurter + cache 1h + fallback EUR + tests résilience |
| E05-004 | ⬜ A faire | Route `/films/analytics`, KPIs + filtres, tracking branché, tests passants |

---

## Tickets

### E05-001 — Page catalogue avec filtres

**Priorité** : P0 | **Taille** : L

#### Objectif

Permettre à un exploitant de trouver un film en moins de 30 secondes et de comprendre immédiatement sa disponibilité et ses prix selon ses cinémas.

#### Scope fonctionnel

Filtres :
- Titre (`ILIKE`).
- Réalisateur (multi-select).
- Acteur / distribution (multi-select).
- Ayant droit (multi-select).
- Genre (multi-select).
- Année de sortie (slider min/max).
- Durée (slider min/max).
- Pays d'origine / tournage (multi-select).
- Type (`direct` uniquement / tous).
- Disponibilité territoire (checkbox active par défaut).

Tri :
- Par défaut: titre A-Z.
- Autres: titre Z-A, année asc/desc, prix asc/desc.

Affichage :
- Vue grille par défaut.
- Vue liste dense disponible.
- Card grille: poster, titre, ayant droit, badge type, lignes de prix compatibles, état disponibilité.
- Label indisponibilité: `Indisponible pour vos cinémas`.
- Boutons d'action désactivés en indisponibilité territoire.

Pagination :
- Côté serveur uniquement.
- Params URL: `page`, `limit`, `sort`, `order`, `search` + filtres sérialisés.
- Multi-select URL: format répété (`key=value1&key=value2`) via `URLSearchParams.getAll`.
- Taille par défaut: `24` (grille), `50` (liste).
- Taille max autorisée: `100`.
- Contrainte cible: 10 000 films / 100 ayants droit.

Persistance utilisateur :
- URL source de vérité.
- Dernière configuration restaurée via `localStorage`.

#### Critères d'acceptance

- Sans query params, le filtre disponibilité est actif.
- Les filtres modifient l'URL de manière déterministe.
- Un reload conserve état + pagination.
- Le tri par défaut est A-Z.
- Aucun calcul de pagination n'est fait côté client.
- L'affichage reste lisible desktop et mobile.

#### Notes techniques

- Prévoir indexes sur `films.title`, `films.status`, `films.releaseYear`, `films.duration`, `films.accountId`.
- Vérifier la latence des requêtes filtrées sous volume cible.

#### Attendus de suivi

- Passer le ticket en `🔄 En cours` dès démarrage implémentation.
- Mettre à jour la checklist du ticket à chaque merge partielle (backend, UI, tests).
- Passer en `✅ Done` uniquement après `pnpm typecheck && pnpm lint && pnpm test` + E2E catalogue vert.

#### Découpage technique détaillé

##### Phase 1: Foundation Backend (3-4j)

**Tâche 1.1 — Service layer: catalog query builder**
- Fichier: `src/lib/services/catalog-service.ts`
- Fonction: `buildCatalogQuery(accountId, filters, pagination, sort)`
- Implémentation:
  - Query builder Drizzle avec composition conditionnelle des filtres
  - Gestion disponibilité territoire: jointure `films` → `filmPrices` → filtrage par pays cinémas
  - Multi-select (directors, cast, genres, countries, rightsHolders): `OR` dans chaque array
  - Slider année/durée: `gte`/`lte`
  - Recherche titre: `ILIKE %term%`
  - Tri dynamique: `orderBy` avec direction
  - Pagination: `limit` + `offset`
- Tests unit: `src/lib/services/__tests__/catalog-query-builder.test.ts`

**Tâche 1.2 — Service layer: availability checker**
- Fichier: `src/lib/services/catalog-availability.ts`
- Fonction: `checkFilmAvailability(filmId, accountCinemas): { available, matchingPrices }`
- Logique:
  - Récupérer cinémas actifs de l'exploitant
  - Récupérer zones prix du film
  - Intersections pays cinémas ∩ pays zones prix
  - Retourner disponibilité + liste zones compatibles
- Tests unit: `src/lib/services/__tests__/catalog-availability.test.ts`

**Tâche 1.3 — Service layer: catalog with pricing**
- Fichier: `src/lib/services/catalog-service.ts`
- Fonction: `getCatalogForExhibitor(accountId, filters, options)`
- Composition:
  - Appel `buildCatalogQuery`
  - Pour chaque film, appel `checkFilmAvailability`
  - Enrichissement objet film avec `availableForAccount`, `matchingPrices[]`
  - Count total pour pagination
- Retour: `{ films: FilmWithAvailability[], total, page, limit }`
- Tests unit: coverage exhaustive des combinaisons filtres

**Dépendances**: aucune (début recommandé)

---

##### Phase 2: API Routes (1-2j)

**Tâche 2.1 — API route GET /api/v1/catalog**
- Fichier: `src/app/api/v1/catalog/route.ts`
- Handler `GET`:
  - Auth vérification (Bearer token ou session)
  - Parsing query params: `page`, `limit`, `sort`, `order`, `search`, `availability`, multi-selects
  - Validation Zod des params
  - Appel `getCatalogForExhibitor`
  - Retour: `{ data: films[], pagination: { page, limit, total } }`
- Error handling: 400, 401, 500
- Tests API: `src/app/api/v1/catalog/__tests__/route.test.ts`

**Tâche 2.2 — Documentation API**
- Fichier: `docs/api/v1/catalog.md`
- Contenu:
  - Description endpoint
  - Auth required
  - Query params exhaustifs avec types + exemples
  - Réponses 200, 400, 401, 500
  - Exemples curl

**Dépendances**: Phase 1 terminée

---

##### Phase 3: UI Components (4-5j)

**Tâche 3.1 — URL state management**
- Fichier: `src/lib/hooks/use-catalog-filters.ts`
- Hook custom:
  - `useCatalogFilters()` → lit/écrit query params
  - Sérialisation/désérialisation filtres URL
  - Multi-select: `URLSearchParams.getAll()`
  - Sync avec `useRouter()` de next-intl
  - Persistance `localStorage` (dernière config)
- Tests unit: mock `useSearchParams`

**Tâche 3.2 — Composant filtres**
- Fichier: `src/components/catalog/catalog-filters.tsx`
- Props: `filters`, `onFiltersChange`
- UI:
  - Input recherche (debounced 300ms)
  - Multi-selects (shadcn Select multiple)
  - Sliders année/durée (shadcn Slider)
  - Checkbox disponibilité (checked par défaut)
  - Bouton reset filtres
- Accessible: labels, keyboard navigation
- Tests: render + interactions utilisateur

**Tâche 3.3 — Composant card film grille**
- Fichier: `src/components/catalog/film-card-grid.tsx`
- Props: `film: FilmWithAvailability`
- Layout:
  - Poster TMDB (`next/image`)
  - Titre tronqué
  - Ayant droit
  - Badge type (`Badge` shadcn)
  - Prix zones compatibles (liste)
  - Badge indisponibilité si applicable
  - Lien vers fiche film avec `target="_blank"`
- Tests: snapshot + cas indisponible

**Tâche 3.4 — Composant liste films dense**
- Fichier: `src/components/catalog/film-list-table.tsx`
- Props: `films: FilmWithAvailability[]`
- Colonnes: Poster mini | Titre | Réalisateur | Année | Durée | Genre | Ayant droit | Prix | Type | Disponibilité
- Tri cliquable sur colonnes
- Tests: render + tri

**Tâche 3.5 — Pagination serveur**
- Fichier: `src/components/catalog/catalog-pagination.tsx`
- Props: `page`, `total`, `limit`, `onPageChange`
- UI: shadcn Pagination
- Update URL au changement de page
- Tests: navigation entre pages

**Tâche 3.6 — Page catalogue principale**
- Fichier: `src/app/[locale]/(app)/catalog/page.tsx`
- Server Component:
  - Parse `searchParams` pour SSR initial
  - Fetch initial via service (pas d'API call interne)
- Client wrapper: `catalog-page-client.tsx`
  - Gestion état filtres (hook)
  - Fetch API `/api/v1/catalog` au changement filtres
  - Loading states (Suspense boundaries)
  - Toggle grille/liste
  - Rendu conditionnel FilmCardGrid | FilmListTable
- Tests: smoke test render

**Dépendances**: Phase 2 terminée (API disponible)

---

##### Phase 4: Tests E2E (2j)

**Tâche 4.1 — E2E catalog flows**
- Fichier: `e2e/catalog.spec.ts`
- Setup:
  - Fixtures: exploitant avec 2 cinémas (FR, BE)
  - Fixtures: 50 films divers (actifs, divers ayants droit, zones prix variées)
- Scénarios:
  - Ouverture catalogue → filtre disponibilité actif + tri A-Z
  - Recherche titre → URL update + résultats filtrés
  - Application multi-filtres → URL reflète état
  - Reload page → état restauré
  - Navigation pagination → page 2, filtres conservés
  - Toggle grille/liste → affichage change, filtres conservés
  - Clic film → nouvel onglet ouvert
  - Film indisponible → bouton désactivé
  - Viewport mobile → layout responsive, pas de régression

**Dépendances**: Phase 3 terminée (UI complète)

---

##### Phase 5: Optimisations & Polish (1-2j)

**Tâche 5.1 — Indexes DB**
- Fichier: migration Drizzle
- Indexes:
  - `films(title)` pour recherche
  - `films(status, accountId)` composite
  - `films(releaseYear, duration)` pour sliders
  - `filmPrices(countries)` GIN index (PostgreSQL array)

**Tâche 5.2 — Performance check**
- Benchmark requêtes sous 10k films
- Vérifier p95 < 500ms
- Optimiser N+1 si détecté

**Tâche 5.3 — Accessibilité audit**
- axe-core sur page catalogue
- Keyboard navigation complète
- Focus visible sur tous contrôles
- ARIA labels corrects

**Dépendances**: toutes phases précédentes

---

##### Ordre d'implémentation recommandé

1. **Phase 1** (backend solide en premier)
2. **Phase 2** (API testable indépendamment)
3. **Phase 3** (UI consomme API stabilisée)
4. **Phase 4** (E2E valide le parcours complet)
5. **Phase 5** (optimisations sur base fonctionnelle)

##### Checklist de validation par phase

- [ ] Phase 1: tests unit verts, service functions exportées
- [ ] Phase 2: tests API verts, doc complète
- [ ] Phase 3: UI fonctionnelle, filtres URL sync, tests components verts
- [ ] Phase 4: E2E vert sur scénarios critiques
- [ ] Phase 5: perf OK, accessibilité OK, indexes créés

---

### E05-002 — Fiche film détaillée

**Priorité** : P0 | **Taille** : M

#### Objectif

Créer une fiche premium qui augmente la conversion vers panier ou demande.

#### Navigation

- Route: `/[locale]/catalog/[filmId]`.
- Ouverture systématique dans un nouvel onglet depuis la grille/liste catalogue.

#### Direction UX

- Hero avec backdrop TMDB (bannière).
- Poster + identité film dans la zone haute.
- Encart action/prix sticky sur desktop.

#### Contenu

- Titre original + local.
- Synopsis.
- Réalisateur, cast principal.
- Durée, année, genres, pays.
- Ayant droit (logo si disponible).
- Badge type (`Achat direct` / `Validation requise`).
- Prix HT des zones compatibles.
- Conversion indicative si devise préférée différente.
- Mention explicite sur devise de paiement finale.

#### Actions et modales

- `Achat direct` -> ouvre modale (CTA `Ajouter au panier`).
- `Validation requise` -> ouvre la même modale (CTA `Envoyer ma demande`).

Champs modale (communs) :
- Obligatoires: cinéma, salle, quantité (nombre de visionnages).
- Optionnels: date début prévue, date fin prévue.
- Quantité: minimum `1`, pas de limite max fonctionnelle.
- Calcul: `total = quantité * prix unitaire`.
- Le total est recalculé en temps réel selon la devise d'affichage sélectionnée dans la modale.
- Devise modale modifiable par l'utilisateur (affichage), avec fallback `EUR`.
- Validation inline + messages explicites.
- Indicateur explicite si un item identique existe déjà au panier ou si une demande est déjà en cours pour ce film.
- Fermeture automatique de la modale après succès.

#### Critères d'acceptance

- La fiche s'ouvre bien dans un nouvel onglet depuis le catalogue.
- Les données manquantes n'entraînent aucune rupture UI.
- Les deux actions ouvrent la même modale avec CTA adaptés.
- Le total se met à jour en temps réel.
- Le bouton d'action est désactivé si le film est indisponible territoire.

#### Attendus de suivi

- Prototype UI validé avant intégration finale.
- Intégration modale unique avec variante d'action (`Ajouter au panier` / `Envoyer ma demande`).
- Vérification des messages doublons panier/demande en E2E.

---

### E05-003 — Affichage du prix dans la devise de préférence

**Priorité** : P2 | **Taille** : M

#### Décisions

- Provider: Frankfurter.
- Cache: 1 heure.

#### Comportement attendu

- Format: `150 EUR (~162 USD au taux du jour)`.
- Si devise préférée identique: pas de ligne convertie.
- Si provider indisponible: fallback sur prix natif sans blocage.
- Si devise préférée absente/invalide: fallback `EUR`.
- Afficher une information de fraîcheur du taux (date/heure).

#### Critères d'acceptance

- Le rendu converti est cohérent avec le taux cache actif.
- Aucun échec API externe ne bloque le catalogue ou la fiche.

#### Attendus de suivi

- Mettre en place des tests unitaires de fallback provider/down.
- Documenter la stratégie cache et l'horodatage taux.

---

### E05-004 — Catalogue vue Ayant Droit

**Priorité** : P1 | **Taille** : M

#### Décision

Créer une vue dédiée `/films/analytics`.

#### Scope

- Liste des films avec statut, type, zones/prix.
- KPIs film: réservations, revenus générés.
- Accès rapide vers édition.
- Filtres: statut, type, zone géographique.

KPIs globaux minimum :
- Vues films.
- Ajouts panier.
- Demandes envoyées.
- Top recherches et top filtres.

#### Critères d'acceptance

- Route analytics distincte de la page de gestion catalogue.
- Les indicateurs sont cohérents avec données commandes/demandes.
- Les filtres affectent tableaux et KPIs.

#### Attendus de suivi

- Définir la source de vérité de chaque KPI avant développement.
- Ajouter instrumentation tracking avant validation finale du ticket.

---

## Dépendances Inter-Epics

### E08 — Paiement multi-ayants droit

Décision recommandée pour P0/P1 :
- Panier potentiellement multi-ayants droit.
- Checkout exécuté par lot mono-ayant droit (N paiements).

Raison : limiter la complexité Stripe Connect (split, transferts, remboursements, multi-devise) au démarrage.

---

## Plan de Tests (Unit, API, E2E)

### 1) Tests unitaires (Vitest)

Fichiers cibles suggérés :
- `src/lib/services/__tests__/catalog-query-builder.test.ts`
- `src/lib/services/__tests__/catalog-availability.test.ts`
- `src/lib/services/__tests__/catalog-price-display.test.ts`
- `src/lib/services/__tests__/exchange-rate-service.test.ts`
- `src/lib/services/__tests__/catalog-modal-state.test.ts`

Cas minimum :
- Disponibilité territoire true si au moins un pays cinéma intersecte une zone prix.
- Disponibilité false sans intersection.
- Rendu prix: 1 ligne si 1 zone, plusieurs lignes sinon.
- Tri A-Z par défaut si aucun tri fourni.
- Parsing filtres URL robuste (valeurs invalides ignorées avec fallback sûr).
- Parsing multi-select en `getAll` sur query params répétés.
- Conversion devise: même devise => pas de conversion.
- Conversion devise: provider down => fallback prix natif.
- Conversion devise: `preferredCurrency` absente/invalide => fallback `EUR`.
- Modale: quantité min 1, recalcul total en temps réel, changement devise d'affichage sans impact devise native.

### 2) Tests API (Vitest + route handlers)

Routes à couvrir (à créer/adapter selon design final):
- `GET /api/v1/catalog`
- `GET /api/v1/catalog/:filmId`
- `POST /api/v1/cart/items` (flux direct via modale)
- `POST /api/v1/requests` (flux validation via modale)
- `GET /api/internal/exchange-rates` (si endpoint interne retenu)

Cas minimum :
- Auth requise: 401 sans token/session valide.
- Pagination serveur: `page`, `limit` valides et bornés (`limit <= 100`).
- Filtre disponibilité actif par défaut sans param explicite.
- Filtres multi-select correctement appliqués.
- Tri A-Z par défaut.
- Film sans zone compatible: `available=false`, action achat indisponible.
- Création panier/demande: validation Zod des champs modale.
- Création panier/demande: `quantity >= 1`.
- Détection doublon: réponse explicite pour article panier existant / demande déjà en cours.
- Gestion erreurs normalisée: `{ error: { code, message } }`.

### 3) Tests E2E (Playwright)

Fichier cible suggéré :
- `e2e/catalog.spec.ts`

Scénarios minimum :
- Ouverture catalogue: filtre disponibilité actif, tri A-Z.
- Recherche + filtres -> URL reflète l'état, reload conserve l'état.
- Pagination serveur: navigation page 1 -> 2 sans perte de filtres.
- Bascule grille/liste sans casser la sélection de filtres.
- Clic film ouvre systématiquement une fiche dans un nouvel onglet.
- Fiche film: affichage des prix compatibles + badge type.
- Film `direct`: modale unique, validation des champs, calcul total dynamique, soumission OK.
- Film `validation`: même modale, CTA différent, validation des champs, soumission OK.
- Film indisponible territoire: action désactivée.
- Message d'alerte visible en cas de doublon panier/demande.
- Responsive smoke test: 1 scénario viewport mobile, pas de blocage UX critique.

### 4) Tests analytics (E05-004)

Unit/API :
- Agrégations KPI correctes sur dataset contrôlé.
- Filtres analytics impactent bien les agrégats.
- Événement `film_viewed` compté uniquement après 5 secondes d'engagement.

E2E :
- Accès `/films/analytics` pour ayant droit.
- Changement filtre met à jour tableau + KPI.

### 5) Tests non-fonctionnels

- Performance backend: requêtes catalogue p95 < 500 ms sur dataset 10k (hors cold start).
- Résilience provider FX: timeout/failure Frankfurter sans impact bloquant.
- Accessibilité: navigation clavier des filtres, labels, focus visible, modales accessibles.

---

## Checklist de Livraison

1. Specs validées et figées.
2. Contrat API documenté dans `docs/api/v1/`.
3. Unit tests ajoutés et passants.
4. API tests ajoutés et passants.
5. E2E catalogue ajoutés et passants (`pnpm test:e2e`).
6. Lint + typecheck + test green.
7. Mise à jour de l'epic E05 et des tickets (statut + checklist) à chaque jalon de développement.
