# Films API

## GET /api/v1/films

List films for the authenticated account (excludes retired/archived films).

**Auth**: Bearer token (required)

**Query params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page  | int  | 1       | Page number |
| limit | int  | 20      | Items per page (max 100) |

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Le Mépris",
      "externalId": "CAT-001",
      "status": "active",
      "type": "direct",
      "releaseYear": 1963,
      "posterUrl": "https://image.tmdb.org/t/p/w500/...",
      "tmdbMatchStatus": "matched",
      "prices": [
        {
          "id": "uuid",
          "countries": ["FR", "BE"],
          "price": 30000,
          "currency": "eur"
        }
      ],
      "createdAt": "2026-04-01T10:00:00.000Z",
      "updatedAt": "2026-04-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42
  }
}
```

**Errors**: 401 Unauthorized

---

## POST /api/v1/films

Create a new film.

**Auth**: Bearer token (required)

**Request body**:
| Field      | Type     | Required | Description                          |
|------------|----------|----------|--------------------------------------|
| title      | string   | Yes      | Film title                           |
| externalId | string   | No       | Rights holder's catalogue reference  |
| type       | string   | No       | `"direct"` (default) or `"validation"` |
| status     | string   | No       | `"active"` (default) or `"inactive"` |
| prices     | array    | Yes      | At least one price zone              |

**Price zone object**:
| Field     | Type     | Required | Description                                |
|-----------|----------|----------|--------------------------------------------|
| countries | string[] | Yes      | ISO 3166-1 alpha-2 country codes           |
| price     | integer  | Yes      | Price in cents (e.g., 30000 = 300.00)      |
| currency  | string   | Yes      | Stripe-compatible ISO currency code        |

**Request example**:
```json
{
  "title": "Le Mépris",
  "externalId": "CAT-001",
  "type": "direct",
  "prices": [
    {
      "countries": ["FR", "BE", "CH"],
      "price": 30000,
      "currency": "eur"
    },
    {
      "countries": ["US", "GB"],
      "price": 40000,
      "currency": "usd"
    }
  ]
}
```

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "title": "Le Mépris",
    "externalId": "CAT-001",
    "status": "active",
    "type": "direct",
    "createdAt": "2026-04-01T10:00:00.000Z"
  }
}
```

**Errors**: 400 Invalid input, 401 Unauthorized, 409 Duplicate external ID

---

## GET /api/v1/films/:filmId

Get a single film by ID.

**Auth**: Bearer token (required)

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "title": "Le Mépris",
    "externalId": "CAT-001",
    "status": "active",
    "type": "direct",
    "tmdbId": 694,
    "tmdbMatchStatus": "matched",
    "synopsis": "...",
    "releaseYear": 1963,
    "duration": 103,
    "directors": ["Jean-Luc Godard"],
    "cast": ["Brigitte Bardot", "Michel Piccoli"],
    "genres": ["Drama", "Romance"],
    "posterUrl": "https://image.tmdb.org/t/p/w500/...",
    "prices": [
      {
        "id": "uuid",
        "countries": ["FR", "BE"],
        "price": 30000,
        "currency": "eur"
      }
    ],
    "createdAt": "2026-04-01T10:00:00.000Z",
    "updatedAt": "2026-04-01T10:00:00.000Z"
  }
}
```

**Errors**: 401 Unauthorized, 404 Not found

---

## GET /api/v1/films/:filmId/prices

List all price zones for a film.

**Auth**: Bearer token (required)

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "filmId": "uuid",
      "countries": ["FR", "BE"],
      "price": 30000,
      "currency": "EUR",
      "createdAt": "2026-04-01T10:00:00.000Z",
      "updatedAt": "2026-04-01T10:00:00.000Z"
    }
  ]
}
```

**Errors**: 401 Unauthorized, 404 Not found

---

## POST /api/v1/films/:filmId/prices

Create a price zone for a film.

**Auth**: Bearer token (required)

**Request body**:
| Field     | Type     | Required | Description                       |
|-----------|----------|----------|-----------------------------------|
| countries | string[] | Yes      | ISO country codes for this zone   |
| price     | integer  | Yes      | Price in cents                    |
| currency  | string   | Yes      | ISO currency code                 |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "filmId": "uuid",
    "countries": ["FR", "BE"],
    "price": 30000,
    "currency": "EUR"
  }
}
```

**Errors**: 400 Invalid input, 401 Unauthorized, 404 Not found, 409 Duplicate country

---

## PATCH /api/v1/films/:filmId/prices/:priceId

Update one price zone.

**Auth**: Bearer token (required)

**Request body**:
| Field     | Type     | Required | Description                          |
|-----------|----------|----------|--------------------------------------|
| countries | string[] | No       | Replaces countries list for the zone |
| price     | integer  | No       | Price in cents                       |
| currency  | string   | No       | ISO currency code                    |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "filmId": "uuid",
    "countries": ["FR", "CH"],
    "price": 32000,
    "currency": "EUR"
  }
}
```

**Errors**: 400 Invalid input, 401 Unauthorized, 404 Not found, 409 Duplicate country

---

## DELETE /api/v1/films/:filmId/prices/:priceId

Delete one price zone.

**Auth**: Bearer token (required)

**Response 200**:
```json
{
  "data": { "deleted": true }
}
```

**Errors**: 401 Unauthorized, 404 Not found, 409 Cannot delete last price zone

---

## PATCH /api/v1/films/:filmId

Update a film. All fields are optional.

**Auth**: Bearer token (required)

**Request body**:
| Field      | Type     | Required | Description                          |
|------------|----------|----------|--------------------------------------|
| title      | string   | No       | Film title                           |
| externalId | string   | No       | Catalogue reference (null to clear)  |
| type       | string   | No       | `"direct"` or `"validation"`         |
| status     | string   | No       | `"active"` or `"inactive"`           |
| prices     | array    | No       | Replaces all existing price zones    |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "title": "Updated Title",
    "status": "active",
    "updatedAt": "2026-04-02T10:00:00.000Z"
  }
}
```

**Errors**: 400 Invalid input, 401 Unauthorized, 404 Not found, 409 Duplicate external ID

---

## DELETE /api/v1/films/:filmId

Archive a film (sets status to `retired`). The film is not permanently deleted.

**Auth**: Bearer token (required)

**Response 200**:
```json
{
  "data": { "archived": true }
}
```

**Errors**: 401 Unauthorized, 404 Not found
