# Requests API

Endpoints for managing booking requests between exhibitors and rights holders.

---

## Exhibitor endpoints

### POST /api/v1/requests

Create a new booking request for a film.

**Auth**: Bearer token (required — exhibitor account)

**Request body**:

| Field          | Type   | Required | Description                              |
|----------------|--------|----------|------------------------------------------|
| filmId         | string | Yes      | UUID of the film                         |
| cinemaId       | string | Yes      | UUID of the cinema                       |
| roomId         | string | Yes      | UUID of the screening room               |
| screeningCount | int    | No       | Number of screenings (default: 1)        |
| startDate      | string | No       | Start date (YYYY-MM-DD)                  |
| endDate        | string | No       | End date (YYYY-MM-DD)                    |
| note           | string | No       | Note for the rights holder               |

**Response 201**:

```json
{
  "data": { "id": "uuid" }
}
```

**Errors**: 400 Invalid input, 401 Unauthorized, 403 Territory not available, 404 Film not found

---

### GET /api/v1/requests

List all requests for the authenticated exhibitor account.

**Auth**: Bearer token (required — exhibitor account)

**Query params**:

| Param  | Type   | Default | Description                                    |
|--------|--------|---------|------------------------------------------------|
| page   | int    | 1       | Page number                                    |
| limit  | int    | 20      | Items per page (max 100)                       |
| status | string | –       | Filter by status (pending, approved, rejected, cancelled, paid) |

**Response 200**:

```json
{
  "data": [
    {
      "id": "uuid",
      "status": "pending",
      "screeningCount": 3,
      "startDate": "2026-07-01",
      "endDate": "2026-07-15",
      "displayedPrice": 15000,
      "currency": "EUR",
      "note": "Summer season",
      "createdAt": "2026-06-01T10:00:00.000Z",
      "film": { "id": "uuid", "title": "Vertigo", "posterUrl": "..." },
      "rightsHolderAccount": { "id": "uuid", "companyName": "StudioCanal" },
      "cinema": { "id": "uuid", "name": "Le Champo" },
      "room": { "id": "uuid", "name": "Salle 1" },
      "createdByUser": { "id": "uuid", "name": "Jean Dupont" }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5 }
}
```

**Errors**: 401 Unauthorized

---

### POST /api/v1/requests/:requestId/cancel

Cancel a pending request.

**Auth**: Bearer token (required — exhibitor account, must own the request)

**URL params**: `requestId` (UUID)

**Request body** (optional):

| Field  | Type   | Description                     |
|--------|--------|---------------------------------|
| reason | string | Cancellation reason (max 1000)  |

**Response 200**:

```json
{
  "data": { "id": "uuid", "status": "cancelled" }
}
```

**Errors**: 400 Invalid input, 401 Unauthorized, 403 Forbidden, 404 Not found, 409 Not in pending status

---

### POST /api/v1/requests/:requestId/relaunch

Relaunch a cancelled or rejected request. Creates a new pending request with the same data.

**Auth**: Bearer token (required — exhibitor account, must own the original request)

**URL params**: `requestId` (UUID)

**Response 201**:

```json
{
  "data": { "id": "new-uuid", "status": "pending" }
}
```

**Errors**: 400 Invalid input, 401 Unauthorized, 409 Cannot relaunch (not cancelled/rejected or not found)

---

## Rights holder endpoints

### GET /api/v1/requests/incoming

List incoming requests received by the authenticated rights holder account. Returns pending requests by default.

**Auth**: Bearer token (required — rights holder account)

**Query params**:

| Param  | Type   | Default   | Description                                    |
|--------|--------|-----------|------------------------------------------------|
| page   | int    | 1         | Page number                                    |
| limit  | int    | 20        | Items per page (max 100)                       |
| status | string | pending   | Filter by status (pending, approved, rejected, cancelled, paid) |
| filmId | string | –         | Filter by film UUID                            |

**Response 200**:

```json
{
  "data": [
    {
      "id": "uuid",
      "status": "pending",
      "screeningCount": 3,
      "startDate": "2026-07-01",
      "endDate": "2026-07-15",
      "displayedPrice": 15000,
      "currency": "EUR",
      "note": "Summer season",
      "createdAt": "2026-06-01T10:00:00.000Z",
      "film": { "id": "uuid", "title": "Vertigo", "posterUrl": "..." },
      "exhibitorAccount": { "id": "uuid", "companyName": "Cinéma Le Champo", "country": "FR", "vatNumber": "FR12345678901" },
      "cinema": { "id": "uuid", "name": "Le Champo", "city": "Paris", "country": "FR" },
      "room": { "id": "uuid", "name": "Salle 1", "capacity": 120 },
      "createdByUser": { "id": "uuid", "name": "Jean Dupont" }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3 }
}
```

**Errors**: 401 Unauthorized

---

### POST /api/v1/requests/:requestId/approve

Approve a pending request.

**Auth**: Bearer token (required — rights holder account, must own the film)

**URL params**: `requestId` (UUID)

**Request body** (optional):

| Field | Type   | Description                           |
|-------|--------|---------------------------------------|
| note  | string | Approval comment for exhibitor (max 1000) |

**Response 200**:

```json
{
  "data": { "id": "uuid", "status": "approved" }
}
```

**Errors**: 400 Invalid input, 401 Unauthorized, 403 Forbidden, 404 Not found, 409 Not in pending status

---

### POST /api/v1/requests/:requestId/reject

Reject a pending request.

**Auth**: Bearer token (required — rights holder account, must own the film)

**URL params**: `requestId` (UUID)

**Request body** (optional):

| Field  | Type   | Description                        |
|--------|--------|------------------------------------|
| reason | string | Rejection reason (max 1000)        |

**Response 200**:

```json
{
  "data": { "id": "uuid", "status": "rejected" }
}
```

**Errors**: 400 Invalid input, 401 Unauthorized, 403 Forbidden, 404 Not found, 409 Not in pending status
