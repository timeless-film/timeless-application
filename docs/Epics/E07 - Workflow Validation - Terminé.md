# E07 — Workflow de Validation par l'Ayant Droit

**Phase** : P2
**Statut** : ✅ Done

---

## Contexte

Certains films nécessitent une validation explicite de l'ayant droit avant que la transaction puisse avoir lieu. Ce workflow doit être simple, rapide, et accessible depuis l'email directement (sans avoir à se connecter). L'email contient toutes les informations permettant de prendre une décision, le destinataire peut aussi le transférer en interne à un décisionnaire.

---

## Acquis des épics précédents

Les fondations suivantes sont déjà en place depuis E06 :

1. **Schema `requests`** avec les champs clés : `validationToken`, `rejectionReason`, `approvedAt`, `rejectedAt`, `status` enum (`pending`, `approved`, `rejected`, `cancelled`, `paid`).
2. **Machine d'états** dans `src/lib/services/request-service.ts` : transitions `pending→approved`, `pending→rejected`, `pending→cancelled` validées et testées (18 unit tests).
3. **Infrastructure email** : `src/lib/email/index.ts` avec wrapper `safeEmail()` (Resend HTTP API) et templates HTML existants (verification, reset password, invitation).
4. **Layout rights holder** : sidebar avec lien "Validation Requests" → `/validation-requests` déjà présent.
5. **Page stub** : `src/app/[locale]/(rights-holder)/validation-requests/page.tsx` existe (titre seul, pas de contenu).
6. **API** : `POST /api/v1/requests` (création côté exploitant), `GET /api/v1/films/:filmId/requests-summary` en place.
7. **E2E helpers** : `e2e/helpers/rights-holder.ts` avec `createRightsHolderContext()` et `loginAsRightsHolder()`.
8. **Counter pattern** : `useCartItemsCount()` hook + `/api/cart/count` endpoint — à réutiliser pour le compteur de demandes pending.

### Items reportés depuis E06 à traiter en E07

1. **E06-005 — Expiration automatique des demandes** : reporté en E06. Le champ `expiresAt` existe en base mais aucune règle n'est active. Reste reporté en E07.
2. **API manquantes E06** :
   - `GET /api/v1/requests` (liste des demandes exploitant) — actuellement via server action uniquement.
   - `POST /api/v1/requests/:requestId/cancel` — actuellement via server action uniquement.
   - `POST /api/v1/requests/:requestId/relaunch` — actuellement via server action uniquement.
   - `DELETE /api/v1/cart/items/:itemId` — hors scope E07 (cart, pas requests).

---

## Décisions produit

1. Les statuts utilisés sont `approved` / `rejected` (aligné sur la DB existante E06).
2. Les emails sont envoyés via **Resend** (infrastructure actuelle et définitive).
3. Les tokens JWT sont signés avec `BETTER_AUTH_SECRET` (secret existant). Expiration = 14 jours. Le payload contient `{ requestId, userId }` — `userId` est l'ID de l'utilisateur destinataire de l'email, ce qui permet de tracer **qui** a traité la demande même depuis la page publique.
4. Les pages accept/refuse sont **publiques** (pas de connexion requise). Le token JWT authentifie l'action. L'email peut être transféré à un tiers pour prise de décision. Si l'utilisateur est connecté sur la page publique, on utilise son `userId` de session (priorité sur celui du token).
5. **Protection anti-rejeu** : pas d'invalidation du token après usage. La protection repose sur la vérification du statut `pending` — si la demande n'est plus `pending`, on affiche un message explicite "Cette demande a déjà été [approuvée/refusée/annulée]".
6. **Tous les utilisateurs** du compte ayant droit (owner, admin, member) reçoivent l'email de notification et peuvent approuver/refuser (depuis le dashboard ou l'email).
7. Les notifications email (après approbation/refus) sont envoyées à **tous les utilisateurs** du compte exploitant (owner, admin, member).
8. L'ayant droit peut ajouter un **commentaire** lors de l'approbation ET du refus. Ce commentaire est affiché côté exploitant (page "Mes demandes") et dans l'email de notification. → Nécessite un nouveau champ `approvalNote` en base.
9. Le dashboard RH affiche par défaut les demandes **`pending` uniquement**, avec un onglet "Historique" / "Traitées" pour voir les anciennes.
10. Un **compteur badge** dans la sidebar RH indique le nombre de demandes `pending` (même pattern que le compteur panier exploitant). Rafraîchissement : polling toutes les **60 secondes** + rechargement à chaque navigation.
11. Le détail d'une demande est une **page dédiée** (`/validation-requests/[requestId]`), pas une modale — pour préparer l'ajout futur de messagerie et d'un fil d'échanges.
12. La **langue de l'email** et du lien CTA utilise la langue préférée de l'utilisateur (`preferredLocale` sur `betterAuthUsers`). → Nécessite un nouveau champ DB.
13. L'expiration automatique (E06-005) **reste reportée**.
14. **Traçabilité** : chaque approbation/refus enregistre l'ID de l'utilisateur qui a traité la demande (`processedByUserId`). Depuis le dashboard = userId de session. Depuis l'email = userId stocké dans le JWT (ou session si connecté). Si transféré à un tiers non-utilisateur = `null`.
15. **Pas d'annulation après approbation** : la transition `approved→cancelled` n'existe pas. Une demande approuvée ne peut qu'être payée (E08).
16. **Modales de confirmation** obligatoires : toute action destructive (approuver, refuser, annuler) nécessite une modale de confirmation avant exécution — côté ayant droit (dashboard + page publique) ET côté exploitant (annulation).
17. **Nom d'expéditeur** : tous les emails sont envoyés avec le nom d'affichage `Timeless <hello@timeless.film>`.
18. **Server actions pour le UI** : le dashboard et les pages Next.js utilisent exclusivement les **server actions** et les requêtes DB directes (Server Components) — jamais `fetch()` vers les API routes internes. Les API routes (`/api/v1/`) sont réservées aux consommateurs externes (apps tierces, intégrations).

---

## Modèle de données

### Champs déjà existants sur `requests`

| Champ | Type | Utilisation E07 |
|---|---|---|
| `validationToken` | text | Token JWT signé pour les CTA email |
| `rejectionReason` | text | Motif de refus (optionnel) |
| `approvedAt` | timestamp | Date d'approbation |
| `rejectedAt` | timestamp | Date de refus |
| `status` | enum | `pending` → `approved` / `rejected` |
| `expiresAt` | timestamp | Non utilisé en E07 (reporté) |

### Nouveaux champs

| Table | Champ | Type | Description |
|---|---|---|---|
| `requests` | `approvalNote` | text (nullable) | Commentaire optionnel de l'ayant droit lors de l'approbation |
| `requests` | `processedByUserId` | text (nullable, FK → `better_auth_users.id`) | ID de l'utilisateur ayant traité la demande (dashboard ou email). `null` si traité par un tiers non-utilisateur via lien transféré. |
| `betterAuthUsers` | `preferredLocale` | text (nullable, default `"en"`) | Langue préférée de l'utilisateur (`"en"` ou `"fr"`) — utilisée pour les emails et liens CTA |

### Pas de nouvelle table nécessaire

Les champs existants + les trois ajouts couvrent tous les besoins E07.

---

## Tickets

### E07-000 — Fondations : schema, token JWT, infrastructure email
**Priorité** : P0 | **Taille** : M | **Statut** : ✅ Done

#### Description
Mettre en place les pré-requis DB, la génération de tokens JWT pour les CTA email, et les utilitaires d'envoi d'emails liés aux demandes.

#### Tâches
1. ✅ **Migration DB** :
   - Ajouter `approvalNote` (text, nullable) sur la table `requests`.
   - Ajouter `processedByUserId` (text, nullable, FK → `better_auth_users.id`) sur la table `requests`.
   - Ajouter `preferredLocale` (text, nullable, default `"en"`) sur la table `better_auth_users`.
   - `pnpm db:generate` + `pnpm db:migrate`.
2. ✅ Créer `src/lib/services/request-token-service.ts` :
   - `generateValidationToken(requestId: string, userId: string)` : génère un JWT signé avec `BETTER_AUTH_SECRET`, payload `{ requestId, userId, action: "validate" }`, expiration 14 jours.
   - `verifyValidationToken(token: string)` : vérifie et décode le token. Retourne `{ requestId, userId }` ou `{ error: "TOKEN_EXPIRED" | "TOKEN_INVALID" }`.
3. ✅ Créer `src/lib/email/request-emails.ts` :
   - `sendRequestNotificationToRightsHolder(params)` : email avec infos de la demande + CTA Accepter/Refuser.
   - `sendRequestApprovedToExhibitor(params)` : email de confirmation d'approbation avec commentaire RH si renseigné.
   - `sendRequestRejectedToExhibitor(params)` : email de notification de refus avec motif si renseigné.
4. ✅ Créer les templates HTML pour chaque email (réutiliser `emailLayout()` existant).
5. ✅ Ajouter les clés i18n nécessaires dans `messages/en.json` et `messages/fr.json`.
6. ✅ Créer la fonction utilitaire `getAccountUserEmails(accountId)` : retourne les emails de **tous les utilisateurs** (owner, admin, member) d'un compte.

#### Critères d'acceptation
1. Le token JWT est généré et stocké dans `requests.validationToken` lors de l'envoi de l'email.
2. Le token peut être vérifié et décodé sans accès DB (self-contained).
3. Les emails utilisent le wrapper `safeEmail()` existant et ne throwent jamais.
4. En dev sans `RESEND_API_KEY`, les emails sont loggés en console.
5. Les emails sont envoyés dans la langue préférée (`preferredLocale`) de chaque destinataire.

---

### E07-001 — Envoi de l'email de demande à l'ayant droit
**Priorité** : P0 | **Taille** : M | **Statut** : ✅ Done

#### Description
Déclenché dès qu'un exploitant soumet une demande pour un film "validation requise". L'email est envoyé automatiquement à **tous les utilisateurs** (owner, admin, member) du compte ayant droit, chacun dans sa langue préférée.

#### Contenu de l'email
- Nom du film demandé
- Informations sur l'exploitant : raison sociale, pays, numéro de TVA
- Informations sur le cinéma : nom, adresse, ville, code postal, pays
- Salle sélectionnée (nom, capacité)
- Nombre de visionnages prévus
- Date de début et date de fin (si renseignées)
- Prix correspondant au territoire (montant affiché à l'exploitant, montant reversé à l'ayant droit)
- Note de l'exploitant (si renseignée)
- Deux boutons CTA : **Accepter** / **Refuser** (liens tokenisés, localisés selon la langue du destinataire)
- Lien de secours vers le dashboard `/validation-requests` si les boutons ne fonctionnent pas

#### Tâches
1. ✅ Modifier `createRequest()` dans `request-service.ts` pour :
   - Générer le `validationToken` via `generateValidationToken()`.
   - Stocker le token en base.
   - Déclencher l'envoi de l'email après insertion réussie (fire-and-forget).
2. ✅ Récupérer tous les utilisateurs du compte ayant droit via `getAccountUserEmails()`.
3. ✅ Construire les URLs CTA localisées : `${APP_URL}/${locale}/request-action?token={jwt}&action=approve`.

#### Critères d'acceptation
1. Après création d'une demande `validation`, un email est envoyé à chaque utilisateur du compte ayant droit.
2. L'email contient toutes les informations requises (film, exploitant, cinéma, salle, prix, dates).
3. Les liens CTA contiennent un token JWT valide et sont localisés selon la langue du destinataire.
4. La note de l'exploitant est affichée si renseignée.
5. Le lien de secours pointe vers `/validation-requests`.
6. L'envoi d'email n'impacte pas la création de la demande en cas d'échec (fire-and-forget).

---

### E07-002 — Acceptation / refus depuis l'email (pages publiques)
**Priorité** : P0 | **Taille** : M | **Statut** : ✅ Done

#### Description
Pages publiques (pas de connexion requise) accessibles via les liens tokenisés de l'email. Le token JWT authentifie l'action. L'email peut avoir été transféré à un tiers — c'est volontaire.

#### Pages
- `src/app/[locale]/(auth)/request-action/page.tsx` : page de traitement de l'action (approve ou reject selon query param).

#### Flow utilisateur
1. Clic sur "Accepter" dans l'email → page avec récapitulatif complet de la demande + champ optionnel "Commentaire" + bouton "Confirmer l'acceptation".
2. Clic sur "Refuser" dans l'email → page avec récapitulatif + champ optionnel "Motif du refus" + bouton "Confirmer le refus".
3. Clic sur le bouton de confirmation → **modale de confirmation** ("Êtes-vous sûr de vouloir approuver/refuser cette demande ?") → confirmation → transition de statut, email de notification à l'exploitant (E07-004), page de succès.
4. L'action enregistre `processedByUserId` : session userId si connecté, sinon userId du JWT, sinon `null`.

#### Cas d'erreur
- Token expiré → message "Ce lien a expiré. Veuillez vous connecter au dashboard pour traiter cette demande." + lien vers `/validation-requests`.
- Token invalide → message "Ce lien n'est pas valide."
- Demande déjà traitée (statut ≠ `pending`) → message "Cette demande a déjà été [approuvée/refusée/annulée]." avec affichage du statut actuel.
- Demande non trouvée → message "Cette demande n'existe pas."

#### Tâches
1. ✅ Créer la route `src/app/[locale]/(auth)/request-action/page.tsx` :
   - Lire les query params `token` et `action` (`approve` | `reject`).
   - Vérifier le token JWT côté serveur.
   - Charger les données de la demande (film, exploitant, cinéma, salle, prix).
   - Afficher le récapitulatif en lecture seule.
2. ✅ Créer le composant client `RequestActionForm` :
   - Formulaire avec champ commentaire/motif optionnel + bouton de confirmation.
   - Appel server action `processRequestAction()`.
3. ✅ Créer la server action `processRequestAction()` :
   - Vérifier token, vérifier statut `pending` (sinon message explicite avec statut actuel), appliquer transition.
   - Stocker `approvalNote` ou `rejectionReason` selon l'action.
   - Stocker `processedByUserId` : session userId (si connecté) > token userId > `null`.
   - Déclencher l'envoi de l'email de notification (E07-004).
   - Retourner `{ success: true }` ou `{ error }`.
4. ✅ Ajouter une **modale de confirmation** avant l'appel server action (shadcn/ui `AlertDialog`).
5. ✅ Gérer tous les cas d'erreur avec messages traduits (i18n).

#### Critères d'acceptation
1. L'acceptation sans connexion fonctionne et change le statut à `approved`, avec commentaire optionnel stocké dans `approvalNote`.
2. Le refus sans connexion fonctionne avec motif optionnel stocké dans `rejectionReason` et change le statut à `rejected`.
3. `processedByUserId` est renseigné : userId de session si connecté, sinon userId du JWT, sinon `null` (lien transféré à un tiers non-utilisateur).
4. Une **modale de confirmation** s'affiche avant l'exécution de l'action.
5. Un token expiré affiche un message clair avec lien vers le dashboard.
6. Une demande déjà traitée affiche un message avec le statut actuel (ex: "Cette demande a déjà été approuvée").
7. La page est accessible sans session utilisateur.
8. Les textes sont traduits (en/fr).

---

### E07-003 — Interface de validation dans le dashboard ayant droit
**Priorité** : P0 | **Taille** : L | **Statut** : ✅ Done

#### Description
Compléter la page stub existante (`/validation-requests`) avec la liste des demandes reçues et les actions de validation. Le détail de chaque demande est affiché sur une **page dédiée** (pas une modale) pour préparer l'ajout futur d'une messagerie entre exploitant et ayant droit.

#### Scope

**Page liste** (`/validation-requests`) :
1. **Vue par défaut : demandes `pending`** — tableau avec colonnes Film, Exploitant, Cinéma, Salle, Dates, Visionnages, Prix, Date de création.
2. **Onglet "Historique"** / "Traitées" : demandes `approved` et `rejected`, avec statut affiché et date de traitement.
3. **Compteur badge** dans la sidebar : nombre de demandes `pending` (même pattern que `useCartItemsCount()`).
4. **Pagination serveur**.

**Page détail** (`/validation-requests/[requestId]`) :
1. Toutes les informations de la demande : film, exploitant (raison sociale, pays, TVA), cinéma (adresse complète), salle (nom, capacité), dates, nombre de visionnages, prix (affiché, reversé), note de l'exploitant.
2. **Actions** (si `pending`) :
   - `Accepter` : champ optionnel "Commentaire" + bouton confirmation → **modale de confirmation** → transition `pending→approved` → email exploitant.
   - `Refuser` : champ optionnel "Motif du refus" + bouton confirmation → **modale de confirmation** → transition `pending→rejected` → email exploitant.
3. **Si déjà traitée** : affichage du statut, date de traitement, commentaire/motif si renseigné. Pas d'action possible.

#### Tâches
1. ✅ Créer la server action `getIncomingRequests()` dans `src/app/[locale]/(rights-holder)/validation-requests/actions.ts` :
   - Requête DB filtrant par `rightsHolderAccountId` et statut (par défaut `pending`).
   - Jointures : film, cinema, room, exhibitor account.
   - Pagination.
2. ✅ Créer le composant `ValidationRequestsPageContent` (client component) avec onglets "En attente" / "Historique".
3. ✅ Créer la page détail `src/app/[locale]/(rights-holder)/validation-requests/[requestId]/page.tsx`.
4. ✅ Créer le composant `RequestDetailPage` avec formulaires d'approbation/refus.
5. ✅ Créer les server actions `approveRequest()` et `rejectRequest()` :
   - Auth check + authorization (la demande appartient au compte RH actif).
   - Appel `transitionRequestStatus()` du service avec `approvalNote` ou `rejectionReason` + `processedByUserId` (userId de session).
   - Envoi email de notification à l'exploitant (E07-004).
6. ✅ Ajouter des **modales de confirmation** (shadcn/ui `AlertDialog`) avant chaque action (approuver/refuser).
7. ✅ Créer le hook `usePendingRequestsCount()` + endpoint `/api/requests/pending-count` (polling **60 secondes** + rechargement à chaque navigation).
8. ✅ Intégrer le compteur badge dans la sidebar RH (item "Demandes de validation").
9. ✅ Compléter la page stub existante avec le composant.
10. ✅ Ajouter les clés i18n (en/fr).

#### Critères d'acceptation
1. La vue par défaut affiche uniquement les demandes `pending`.
2. L'onglet "Historique" affiche les demandes `approved` et `rejected`.
3. Le compteur badge dans la sidebar affiche le nombre de demandes `pending`.
4. La page détail affiche toutes les informations de la demande.
5. Les actions ne sont disponibles que sur les demandes `pending`.
6. Une **modale de confirmation** s'affiche avant chaque action (approuver/refuser).
7. Après approbation, le statut passe à `approved`, le commentaire et `processedByUserId` sont stockés, et un email est envoyé à l'exploitant.
8. Après refus, le statut passe à `rejected`, le motif et `processedByUserId` sont stockés, et un email est envoyé.
9. Pagination serveur avec `page` et `limit`.

---

### E07-004 — Notification au cinéma après validation
**Priorité** : P0 | **Taille** : S | **Statut** : ✅ Done

#### Description
Emails de notification envoyés à l'exploitant après qu'une demande ait été traitée par l'ayant droit. Chaque utilisateur reçoit l'email dans sa langue préférée.

#### Si acceptée
- Email à **tous les utilisateurs** (owner, admin, member) du compte exploitant.
- Contenu : film accepté, récapitulatif de la demande (dates, salle, prix), commentaire de l'ayant droit si renseigné.
- CTA : "Voir ma demande" → lien vers `/requests` (le bouton "Procéder au paiement" sera activé en E08).
- La demande passe en statut `approved` dans "Mes demandes".

#### Si refusée
- Email à **tous les utilisateurs** (owner, admin, member) du compte exploitant.
- Contenu : film refusé, motif du refus si renseigné.
- CTA : "Voir mes demandes" → lien vers `/requests`.
- La demande passe en statut `rejected`.

#### Tâches
1. ✅ Créer les templates HTML dans `src/lib/email/request-emails.ts` (réutiliser `emailLayout()`).
2. ✅ Récupérer les emails de tous les utilisateurs du compte exploitant via `getAccountUserEmails()`.
3. ✅ Intégrer l'envoi dans les flows d'acceptation/refus (dashboard E07-003 et page publique E07-002).
4. ✅ Inclure le commentaire/motif de l'ayant droit dans l'email.

#### Critères d'acceptation
1. Après approbation, les emails sont envoyés à tous les utilisateurs du compte exploitant, chacun dans sa langue.
2. Le commentaire de l'ayant droit (`approvalNote`) est inclus dans l'email si renseigné.
3. Après refus, les emails sont envoyés avec le motif (`rejectionReason`) si renseigné.
4. Le statut dans "Mes demandes" est mis à jour correctement.
5. L'envoi d'email est fire-and-forget (n'impacte pas la transition).

---

### E07-005 — Notification d'expiration
**Priorité** : P3 | **Taille** : S | **Statut** : ⬜ Reporté

#### Description
Ticket reporté — l'expiration automatique (E06-005) n'est pas active. Ce ticket sera implémenté quand l'expiration sera activée.

#### Règles (pour référence future)
- Email à l'ayant droit : "La demande de [Cinéma X] pour [Film Y] a expiré"
- Email à l'exploitant : "Votre demande pour [Film Y] a expiré — vous pouvez en soumettre une nouvelle"
- Déclenché par le cron/job d'expiration (à définir).

---

### E07-006 — API REST demandes côté ayant droit
**Priorité** : P1 | **Taille** : M | **Statut** : ✅ Done

#### Description
Endpoints API REST pour que les ayants droits puissent gérer les demandes reçues via l'API (en plus du dashboard).

Inclut également les endpoints E06 manquants côté exploitant (reportés depuis E06).

#### Endpoints ayant droit (nouveaux)

1. `GET /api/v1/requests/incoming` — Liste des demandes reçues par l'ayant droit.
   - Par défaut : uniquement les demandes `pending`.
   - Filtres optionnels : `status` (pour accéder aux traitées), `filmId`, `page`, `limit`.
   - Réponse : `{ data: [...], pagination: { page, limit, total } }`.

2. `POST /api/v1/requests/:requestId/approve` — Approuver une demande `pending`.
   - Body optionnel : `{ note: "..." }` (commentaire d'approbation).
   - Auth : Bearer token du compte ayant droit.
   - Réponse 200 : `{ data: { id, status: "approved" } }`.
   - Erreurs : 401, 403, 404, 409 (déjà traitée).

3. `POST /api/v1/requests/:requestId/reject` — Refuser une demande `pending`.
   - Body optionnel : `{ reason: "..." }`.
   - Auth : Bearer token du compte ayant droit.
   - Réponse 200 : `{ data: { id, status: "rejected" } }`.
   - Erreurs : 401, 403, 404, 409 (déjà traitée).

#### Endpoints exploitant (reportés E06, à faire maintenant)

4. `GET /api/v1/requests` — Liste des demandes de l'exploitant (filtres, pagination).
5. `POST /api/v1/requests/:requestId/cancel` — Annuler une demande `pending`.
6. `POST /api/v1/requests/:requestId/relaunch` — Relancer une demande `cancelled`/`rejected`.

#### Tâches
1. ✅ Créer `src/app/api/v1/requests/incoming/route.ts` (GET).
2. ✅ Créer `src/app/api/v1/requests/[requestId]/approve/route.ts` (POST).
3. ✅ Créer `src/app/api/v1/requests/[requestId]/reject/route.ts` (POST).
4. ✅ Compléter `src/app/api/v1/requests/route.ts` avec GET (liste exploitant).
5. ✅ Créer `src/app/api/v1/requests/[requestId]/cancel/route.ts` (POST).
6. ✅ Créer `src/app/api/v1/requests/[requestId]/relaunch/route.ts` (POST).
7. ✅ Documenter tous les endpoints dans `docs/api/v1/requests.md`.

#### Critères d'acceptation
1. Tous les endpoints respectent les conventions API v1 (auth Bearer, réponse `{ data }` / `{ error }`).
2. Les transitions de statuts passent par le service layer existant.
3. L'approbation/refus déclenche l'envoi de l'email de notification (E07-004).
4. `GET /api/v1/requests/incoming` retourne `pending` par défaut, toutes si `status` est spécifié.
5. L'approbation accepte un `note` optionnel stocké dans `approvalNote`.
6. La documentation API est à jour.

---

### E07-007 — Mise à jour "Mes demandes" côté exploitant
**Priorité** : P1 | **Taille** : S | **Statut** : ✅ Done

#### Description
Adapter la page "Mes demandes" (implémentée en E06-004) pour refléter les nouveaux statuts et informations liés au workflow de validation.

#### Tâches
1. ✅ Afficher le motif de refus (`rejectionReason`) dans le détail d'une demande `rejected`.
2. ✅ Afficher le commentaire d'approbation (`approvalNote`) dans le détail d'une demande `approved`.
3. ✅ Afficher la date d'approbation/refus dans le détail.
4. ✅ Bouton "Procéder au paiement" actif sur les demandes `approved` (E08 implémenté).
5. ✅ Ajouter un badge/indicateur visuel pour les statuts (pastille "Approuvée" verte, "Refusée" rouge, "En attente" jaune).
6. ✅ Ajouter une **modale de confirmation** sur le bouton "Annuler la demande" (si pas encore présente depuis E06).

#### Critères d'acceptation
1. Le motif de refus est affiché pour les demandes `rejected`.
2. Le commentaire d'approbation est affiché pour les demandes `approved`.
3. Les dates de transition sont visibles.
4. Les badges de statut sont visuellement distincts et traduits.
5. Une **modale de confirmation** s'affiche avant l'annulation d'une demande.

---

## API (section consolidée)

### Endpoints exploitant

| Méthode | Endpoint | Statut | Description |
|---------|----------|--------|-------------|
| `POST` | `/api/v1/requests` | ✅ E06 | Créer une demande |
| `GET` | `/api/v1/requests` | ✅ E07-006 | Lister ses demandes |
| `POST` | `/api/v1/requests/:id/cancel` | ✅ E07-006 | Annuler (pending) |
| `POST` | `/api/v1/requests/:id/relaunch` | ✅ E07-006 | Relancer (cancelled/rejected) |
| `GET` | `/api/v1/films/:filmId/requests-summary` | ✅ E06 | Résumé anti-doublon |

### Endpoints ayant droit

| Méthode | Endpoint | Statut | Description |
|---------|----------|--------|-------------|
| `GET` | `/api/v1/requests/incoming` | ✅ E07-006 | Demandes reçues (pending par défaut) |
| `POST` | `/api/v1/requests/:id/approve` | ✅ E07-006 | Approuver (avec note optionnelle) |
| `POST` | `/api/v1/requests/:id/reject` | ✅ E07-006 | Refuser (avec motif optionnel) |

### Codes d'erreur E07

| Code | HTTP | Description |
|------|------|-------------|
| `UNAUTHORIZED` | 401 | Token manquant ou invalide |
| `FORBIDDEN` | 403 | La demande n'appartient pas au compte |
| `REQUEST_NOT_FOUND` | 404 | Demande introuvable |
| `REQUEST_ALREADY_PROCESSED` | 409 | Demande déjà traitée (statut ≠ pending) |
| `TOKEN_EXPIRED` | 410 | Token JWT expiré |
| `TOKEN_INVALID` | 400 | Token JWT invalide |
| `INVALID_INPUT` | 400 | Payload invalide |

---

## Plan de tests

### 1) Tests unitaires (Vitest)

#### `src/lib/services/__tests__/request-token-service.test.ts`
1. Génère un token JWT valide pour un requestId et userId donnés.
2. Vérifie et décode un token valide → retourne `{ requestId, userId }`.
3. Rejette un token expiré → retourne `{ error: "TOKEN_EXPIRED" }`.
4. Rejette un token avec signature invalide → retourne `{ error: "TOKEN_INVALID" }`.
5. Rejette un token avec payload malformé → retourne `{ error: "TOKEN_INVALID" }`.

#### `src/lib/services/__tests__/request-service.test.ts` (à compléter)
6. Transition `pending→approved` avec `rightsHolderAccountId` valide → succès.
7. Transition `pending→approved` stocke `approvalNote` et `processedByUserId` si fournis.
8. Transition `pending→rejected` avec `reason` → stocke le `rejectionReason` et `processedByUserId`.
9. Transition `pending→approved` avec mauvais `rightsHolderAccountId` → erreur `UNAUTHORIZED`.
10. Transition depuis un statut terminal (`approved`, `rejected`, `cancelled`) → erreur `INVALID_TRANSITION`.

#### `src/lib/email/__tests__/request-emails.test.ts`
11. `sendRequestNotificationToRightsHolder()` appelle `safeEmail` avec les bons paramètres.
12. Le HTML généré contient le nom du film, le cinéma, le prix, et les liens CTA.
13. Les liens CTA contiennent le token JWT et les bons query params.
14. Les liens CTA utilisent la locale du destinataire.
15. `sendRequestApprovedToExhibitor()` contient le récapitulatif, le lien vers `/requests`, et le commentaire RH si renseigné.
16. `sendRequestRejectedToExhibitor()` contient le motif de refus quand renseigné.
17. `sendRequestRejectedToExhibitor()` sans motif affiche un message générique.

#### `src/lib/services/__tests__/account-users.test.ts`
18. `getAccountUserEmails()` retourne les emails de tous les utilisateurs (owner, admin, member) d'un compte.
19. `getAccountUserEmails()` retourne un tableau vide si le compte n'a pas d'utilisateurs.

### 2) Tests API (E2E — Playwright `request` fixture)

#### `e2e/requests.spec.ts` (compléter le fichier existant)

**Endpoints ayant droit :**
1. `GET /api/v1/requests/incoming` — 200 + liste des demandes `pending` par défaut.
2. `GET /api/v1/requests/incoming?status=approved` — retourne uniquement les approuvées.
3. `GET /api/v1/requests/incoming` — pagination correcte (`page`, `limit`, `total`).
4. `POST /api/v1/requests/:id/approve` — 200 + statut `approved`.
5. `POST /api/v1/requests/:id/approve` avec note — note stockée dans `approvalNote`.
6. `POST /api/v1/requests/:id/approve` sur demande déjà traitée — 409 `REQUEST_ALREADY_PROCESSED`.
7. `POST /api/v1/requests/:id/approve` avec mauvais compte RH — 403 `FORBIDDEN`.
8. `POST /api/v1/requests/:id/reject` — 200 + statut `rejected`.
9. `POST /api/v1/requests/:id/reject` avec motif — motif stocké en base.
10. `POST /api/v1/requests/:id/reject` sur demande déjà traitée — 409.
11. Auth manquante sur tous les endpoints RH — 401.

**Endpoints exploitant (reportés E06) :**
12. `GET /api/v1/requests` — 200 + liste des demandes de l'exploitant.
13. `GET /api/v1/requests` — filtrage par statut.
14. `POST /api/v1/requests/:id/cancel` — 200 + statut `cancelled`.
15. `POST /api/v1/requests/:id/cancel` sur demande non-pending — 409.
16. `POST /api/v1/requests/:id/relaunch` — 201 + nouvelle demande `pending` créée.
17. `POST /api/v1/requests/:id/relaunch` sur demande `pending` — 409.

### 3) Tests E2E (Playwright — `page` fixture, UI)

#### `e2e/requests-validation.spec.ts` (nouveau fichier)

**Dashboard ayant droit :**
1. La page `/validation-requests` affiche les demandes `pending` reçues par l'ayant droit (vue par défaut).
2. L'onglet "Historique" affiche les demandes `approved` et `rejected`.
3. Le clic sur une demande navigue vers la page détail `/validation-requests/[requestId]`.
4. La page détail affiche film, exploitant, cinéma, salle, dates, prix, note exploitant.
5. L'approbation d'une demande avec commentaire change le statut à `approved` et stocke le commentaire.
6. Le refus d'une demande avec motif change le statut à `rejected` et stocke le motif.
7. Le refus d'une demande sans motif change le statut à `rejected`.
8. Les boutons Accepter/Refuser ne sont visibles que sur les demandes `pending`.
9. Une modale de confirmation s'affiche avant approbation/refus et l'action n'est exécutée qu'après confirmation.
10. Le compteur badge dans la sidebar affiche le nombre de demandes pending et se met à jour après action.
10. La pagination fonctionne.

**Pages publiques (token-based) :**
11. La page d'approbation via token affiche le récapitulatif et un champ commentaire optionnel.
12. Une modale de confirmation s'affiche après clic sur le bouton d'approbation/refus.
13. Après confirmation d'approbation, le statut passe à `approved` et une page de succès s'affiche.
14. La page de refus via token affiche un champ de motif optionnel.
15. Après refus via token, le statut passe à `rejected`.
16. Un token invalide affiche un message d'erreur.
17. Une demande déjà approuvée affiche "Cette demande a déjà été approuvée".
18. Une demande déjà refusée affiche "Cette demande a déjà été refusée".

**Côté exploitant (mises à jour E07-007) :**
19. La page `/requests` affiche le motif de refus pour les demandes `rejected`.
20. La page `/requests` affiche le commentaire d'approbation pour les demandes `approved`.
21. La page `/requests` affiche la date d'approbation pour les demandes `approved`.
22. Les badges de statut sont visuellement distincts.
23. Une modale de confirmation s'affiche avant l'annulation d'une demande.

---

## Dépendances

- **E08 (Paiement Stripe)** : le bouton "Procéder au paiement" sur les demandes `approved` sera activé en E08.
- **E06-005 (Expiration)** : l'expiration automatique reste reportée. E07-005 sera implémenté quand l'expiration sera activée.

---

## Ordre d'implémentation recommandé

1. **E07-000** — Migration DB (`approvalNote`, `preferredLocale`) + Token JWT + infrastructure email (fondation).
2. **E07-003** — Dashboard ayant droit avec page détail et compteur badge (besoin principal).
3. **E07-001** — Envoi email de demande (déclenché à la création de la demande).
4. **E07-002** — Pages publiques accept/refuse via token (dépend de E07-000).
5. **E07-004** — Notifications exploitant (intégré dans E07-002 et E07-003).
6. **E07-006** — API REST (peut être fait en parallèle de E07-003).
7. **E07-007** — Mises à jour "Mes demandes" côté exploitant (finition).
