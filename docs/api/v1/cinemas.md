# Cinemas

Manage cinemas for the authenticated account.

---

## GET /api/v1/cinemas

List all active (non-archived) cinemas for the authenticated account, including their rooms.

**Auth**: Bearer token (required)

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "accountId": "uuid",
      "name": "Le Grand Rex",
      "country": "FR",
      "city": "Paris",
      "address": "1 boulevard Poissonnière",
      "postalCode": "75002",
      "archivedAt": null,
      "createdAt": "2026-03-15T10:00:00.000Z",
      "updatedAt": "2026-03-15T10:00:00.000Z",
      "rooms": [
        {
          "id": "uuid",
          "cinemaId": "uuid",
          "name": "Salle 1",
          "capacity": 100,
          "reference": null,
          "archivedAt": null,
          "createdAt": "2026-03-15T10:00:00.000Z",
          "updatedAt": "2026-03-15T10:00:00.000Z"
        }
      ]
    }
  ]
}
```

**Errors**: 401 Unauthorized

---

## POST /api/v1/cinemas

Create a new cinema with a default room ("Salle 1", capacity 100).

**Auth**: Bearer token (required)

**Request body**:
```json
{
  "name": "Le Grand Rex",
  "country": "FR",
  "city": "Paris",
  "address": "1 boulevard Poissonnière",
  "postalCode": "75002"
}
```

| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| name       | string | Yes      | Cinema name |
| country    | string | Yes      | ISO 3166-1 alpha-2 country code (e.g. `FR`) |
| city       | string | Yes      | City name |
| address    | string | No       | Street address |
| postalCode | string | No       | Postal code |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "accountId": "uuid",
    "name": "Le Grand Rex",
    "country": "FR",
    "city": "Paris",
    "address": "1 boulevard Poissonnière",
    "postalCode": "75002",
    "archivedAt": null,
    "createdAt": "2026-03-15T10:00:00.000Z",
    "updatedAt": "2026-03-15T10:00:00.000Z"
  }
}
```

**Errors**: 400 Invalid input, 401 Unauthorized, 500 Creation failed

---

## GET /api/v1/cinemas/:cinemaId

Get a single cinema with its rooms.

**Auth**: Bearer token (required)

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "accountId": "uuid",
    "name": "Le Grand Rex",
    "country": "FR",
    "city": "Paris",
    "address": "1 boulevard Poissonnière",
    "postalCode": "75002",
    "archivedAt": null,
    "createdAt": "2026-03-15T10:00:00.000Z",
    "updatedAt": "2026-03-15T10:00:00.000Z",
    "rooms": [
      {
        "id": "uuid",
        "cinemaId": "uuid",
        "name": "Salle 1",
        "capacity": 100,
        "reference": null,
        "archivedAt": null,
        "createdAt": "2026-03-15T10:00:00.000Z",
        "updatedAt": "2026-03-15T10:00:00.000Z"
      }
    ]
  }
}
```

**Errors**: 401 Unauthorized, 404 Not found

---

## PATCH /api/v1/cinemas/:cinemaId

Update a cinema's information. Only provided fields are updated.

**Auth**: Bearer token (required)

**Request body** (all fields optional):
```json
{
  "name": "Le Nouveau Rex",
  "city": "Paris",
  "address": "2 boulevard Poissonnière"
}
```

| Field      | Type          | Description |
|------------|---------------|-------------|
| name       | string        | Cinema name (min 1 char) |
| country    | string        | ISO 3166-1 alpha-2 code |
| city       | string        | City name (min 1 char) |
| address    | string\|null  | Street address (null to clear) |
| postalCode | string\|null  | Postal code (null to clear) |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Le Nouveau Rex",
    "..."
  }
}
```

**Errors**: 400 Invalid input, 401 Unauthorized, 404 Not found

---

## DELETE /api/v1/cinemas/:cinemaId

Archive a cinema (soft delete). The cinema and its rooms are hidden from the interface but preserved in the database.

**Business rule**: Cannot archive the last cinema of an account. At least one active cinema must remain.

**Auth**: Bearer token (required)

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "archivedAt": "2026-03-20T14:30:00.000Z"
  }
}
```

**Errors**: 401 Unauthorized, 404 Not found, 409 Last cinema (cannot archive)
