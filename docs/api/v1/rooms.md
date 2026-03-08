# Rooms

Manage rooms within a cinema. A cinema must always have at least one active room.

---

## GET /api/v1/cinemas/:cinemaId/rooms

List all active (non-archived) rooms for a cinema.

**Auth**: Bearer token (required)

**Response 200**:
```json
{
  "data": [
    {
      "id": "uuid",
      "cinemaId": "uuid",
      "name": "Salle 1",
      "capacity": 100,
      "reference": null,
      "projectionType": "digital",
      "hasDcpEquipment": true,
      "screenFormat": "Scope 2.39",
      "soundSystem": "Dolby 7.1",
      "archivedAt": null,
      "createdAt": "2026-03-15T10:00:00.000Z",
      "updatedAt": "2026-03-15T10:00:00.000Z"
    }
  ]
}
```

**Errors**: 401 Unauthorized, 404 Cinema not found

---

## POST /api/v1/cinemas/:cinemaId/rooms

Create a new room in a cinema.

**Auth**: Bearer token (required)

**Request body**:
```json
{
  "name": "Salle 2",
  "capacity": 200,
  "reference": "S2",
  "projectionType": "digital",
  "hasDcpEquipment": true,
  "screenFormat": "Flat 1.85",
  "soundSystem": "Dolby Atmos"
}
```

| Field           | Type    | Required | Description |
|-----------------|---------|----------|-------------|
| name            | string  | No       | Room name (auto-generated "Salle N" if omitted) |
| capacity        | integer | Yes      | Number of seats (minimum 1) |
| reference       | string  | No       | Internal reference code |
| projectionType  | string  | No       | One of: `digital`, `film_35mm`, `film_70mm` |
| hasDcpEquipment | boolean | No       | Whether DCP equipment is available (default: false) |
| screenFormat    | string  | No       | Screen format (e.g. "Scope 2.39") |
| soundSystem     | string  | No       | Sound system (e.g. "Dolby 7.1") |

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "cinemaId": "uuid",
    "name": "Salle 2",
    "capacity": 200,
    "reference": "S2",
    "projectionType": "digital",
    "hasDcpEquipment": true,
    "screenFormat": "Flat 1.85",
    "soundSystem": "Dolby Atmos",
    "archivedAt": null,
    "createdAt": "2026-03-15T10:00:00.000Z",
    "updatedAt": "2026-03-15T10:00:00.000Z"
  }
}
```

**Errors**: 400 Invalid input, 401 Unauthorized, 404 Cinema not found

---

## GET /api/v1/cinemas/:cinemaId/rooms/:roomId

Get a single room.

**Auth**: Bearer token (required)

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "cinemaId": "uuid",
    "name": "Salle 1",
    "capacity": 100,
    "..."
  }
}
```

**Errors**: 401 Unauthorized, 404 Not found

---

## PATCH /api/v1/cinemas/:cinemaId/rooms/:roomId

Update a room's information. Only provided fields are updated.

**Auth**: Bearer token (required)

**Request body** (all fields optional):
```json
{
  "name": "Grande Salle",
  "capacity": 250,
  "projectionType": "digital",
  "hasDcpEquipment": true
}
```

| Field           | Type           | Description |
|-----------------|----------------|-------------|
| name            | string         | Room name (min 1 char) |
| capacity        | integer        | Number of seats (min 1) |
| reference       | string\|null   | Internal reference (null to clear) |
| projectionType  | string\|null   | Projection type (null to clear) |
| hasDcpEquipment | boolean        | DCP equipment flag |
| screenFormat    | string\|null   | Screen format (null to clear) |
| soundSystem     | string\|null   | Sound system (null to clear) |

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Grande Salle",
    "capacity": 250,
    "..."
  }
}
```

**Errors**: 400 Invalid input/capacity, 401 Unauthorized, 404 Not found

---

## DELETE /api/v1/cinemas/:cinemaId/rooms/:roomId

Archive a room (soft delete). The room is hidden from the interface but preserved in the database.

**Business rule**: Cannot archive the last room of a cinema. At least one active room must remain.

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

**Errors**: 401 Unauthorized, 404 Not found, 409 Last room (cannot archive)
