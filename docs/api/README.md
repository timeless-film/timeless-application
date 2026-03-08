# TIMELESS API

## Overview

The TIMELESS REST API allows external clients (third-party integrations, mobile apps) to interact with the platform programmatically.

**Base URL**: `{APP_URL}/api/v1`

---

## Authentication

All API requests require a **Bearer token** in the `Authorization` header:

```
Authorization: Bearer tmls_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Tokens are created from the **Account > API** tab in the TIMELESS interface. Each token is scoped to a single account.

The raw token is shown **only once** at creation. Only a SHA-256 hash is stored server-side.

---

## Conventions

### Request format

- **Content-Type**: `application/json` for POST/PATCH requests.
- **URL parameters**: path segments for resource IDs (UUIDs).
- **Query parameters**: pagination and filtering.

### Response format

**Success**:
```json
{
  "data": { ... }
}
```

**Success (list with pagination)**:
```json
{
  "data": [ ... ],
  "pagination": { "page": 1, "limit": 20, "total": 42 }
}
```

**Error**:
```json
{
  "error": {
    "code": "UPPER_SNAKE_CASE",
    "message": "Human-readable description"
  }
}
```

### Status codes

| Code | Meaning |
|------|---------|
| 200  | OK |
| 201  | Created |
| 400  | Validation error / bad request |
| 401  | Unauthorized (missing or invalid token) |
| 403  | Forbidden (insufficient permissions) |
| 404  | Resource not found |
| 409  | Conflict (business rule violation) |
| 500  | Internal server error |

### Pagination

List endpoints accept:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page  | int  | 1       | Page number (1-based) |
| limit | int  | 20      | Items per page (max 100) |

---

## Versioning

The API is versioned via URL prefix (`/api/v1/`). Breaking changes will increment the version number.

Non-versioned routes:
- `/api/auth/[...]` — Better Auth (internal)
- `/api/webhooks/stripe` — Stripe webhooks

---

## Resources

- [Cinemas](v1/cinemas.md)
- [Rooms](v1/rooms.md)
