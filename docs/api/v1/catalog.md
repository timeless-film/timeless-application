# Catalog API

## GET /api/v1/catalog

List all films available in the catalog for the authenticated exhibitor account. Results are filtered by territory availability (only films with price zones matching the exhibitor's cinema countries are returned).

**Auth**: Bearer token (required)  
**Account type**: Exhibitor only

---

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | `1` | Page number (min: 1) |
| `limit` | integer | `24` | Items per page (min: 1, max: 100) |
| `sort` | enum | `"title"` | Sort field: `"title"`, `"releaseYear"`, `"price"` |
| `order` | enum | `"asc"` | Sort order: `"asc"`, `"desc"` |
| `search` | string | - | Full-text search in title, original title, synopsis |
| `directors` | string[] | - | Filter by director names (multi-select via repeated param) |
| `cast` | string[] | - | Filter by cast names (multi-select) |
| `genres` | string[] | - | Filter by genre IDs (multi-select) |
| `countries` | string[] | - | Filter by production country codes (multi-select) |
| `rightsHolderIds` | string[] | - | Filter by rights holder account IDs (multi-select) |
| `type` | enum | `"all"` | Film type: `"direct"` (catalog price only), `"all"` |
| `yearMin` | integer | - | Min release year (inclusive) |
| `yearMax` | integer | - | Max release year (inclusive) |
| `durationMin` | integer | - | Min duration in minutes (inclusive) |
| `durationMax` | integer | - | Max duration in minutes (inclusive) |
| `availableForTerritory` | boolean | `true` | If `true`, filter to films with ≥1 price zone matching exhibitor territories |

**Multi-select params**: Repeat the param key for multiple values:
```
GET /api/v1/catalog?genres=action&genres=thriller&countries=FR&countries=IT
```

**Territory availability**: By default (`availableForTerritory=true`), the API only returns films that have at least one price zone covering countries where the exhibitor owns cinemas. Set to `false` to disable this filter.

---

### Response 200

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "title": "Le Mépris",
      "originalTitle": "Il Disprezzo",
      "releaseYear": 1963,
      "duration": 103,
      "director": "Jean-Luc Godard",
      "cast": ["Brigitte Bardot", "Michel Piccoli", "Jack Palance"],
      "country": "FR",
      "genres": ["drame", "romance"],
      "synopsis": "Durant le tournage de l'Odyssée...",
      "posterUrl": "https://image.tmdb.org/t/p/w500/abc123.jpg",
      "rightsHolderId": "550e8400-e29b-41d4-a716-446655440002",
      "rightsHolderName": "Studiocanal",
      "catalogPriceHt": 150000,
      "demandPriceStartingHt": 180000,
      "hasDemandsEnabled": true,
      "isAvailableInTerritory": true,
      "matchingPriceZones": ["FR", "BE", "CH"],
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-03-20T14:22:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 142
  }
}
```

**Field notes**:
- `catalogPriceHt` / `demandPriceStartingHt`: In Euro cents (HT), `null` if film type doesn't allow that mode
- `isAvailableInTerritory`: `true` if ≥1 price zone matches exhibitor territories
- `matchingPriceZones`: Array of country codes where film is available (based on exhibitor's cinema countries)
- All price fields (`catalogPriceHt`, `demandPriceStartingHt`) are always displayed excluding tax (HT)

---

### Errors

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 401 | `UNAUTHORIZED` | Authentication required | Missing or invalid Bearer token |
| 403 | `FORBIDDEN` | Only exhibitor accounts can access the catalog | Account type is `rights_holder` or `admin` |
| 400 | `INVALID_PARAMS` | Invalid query parameters | Zod validation failure (includes `details` field) |
| 500 | `INTERNAL_ERROR` | Internal server error | Unhandled exception |

**Example error response**:
```json
{
  "error": {
    "code": "INVALID_PARAMS",
    "message": "Invalid query parameters",
    "details": {
      "page": {
        "_errors": ["Number must be greater than or equal to 1"]
      }
    }
  }
}
```

---

### Examples

**Basic catalog request (default sort, first page)**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://timeless.film/api/v1/catalog
```

**Search + multi-genre filter + sort by year**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://timeless.film/api/v1/catalog?search=godard&genres=drame&genres=romance&sort=releaseYear&order=desc"
```

**Filter by year range + director + territory availability**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://timeless.film/api/v1/catalog?yearMin=1960&yearMax=1970&directors=Jean-Luc+Godard&availableForTerritory=true"
```

**Pagination (page 2, 50 items)**:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://timeless.film/api/v1/catalog?page=2&limit=50"
```

---

### Business Rules

1. **Territory availability** (default behavior):
   - If exhibitor has cinemas in France and Belgium (FR, BE), only films with price zones covering those countries are returned
   - A film is available if at least one of its price zones has a non-empty intersection with exhibitor territories
   - Example: Film with zones `["FR", "BE", "LU"]` and `["DE", "AT"]` is available because first zone matches FR and BE

2. **Multi-zone pricing**:
   - When a film has multiple price zones (`catalogPriceHt` can differ per zone), the API returns the **zone with the most matching countries**
   - If tie, the **lowest price** wins
   - The `catalogPriceHt` field shows the selected zone's price

3. **HT display**:
   - All prices are always displayed excluding tax (HT)
   - VAT calculation is done at checkout time based on cinema location

4. **Type filtering**:
   - `type=direct`: Only films with `catalogPriceHt` (instant booking without validation)
   - `type=all`: All films (both direct and on-demand)

5. **Performance**:
   - Response time target: < 300ms for typical queries
   - Results are eagerly loaded with all enrichments (no separate calls for prices)

---

## GET /api/v1/catalog/:filmId

Get detailed information for a single film in the catalog. Returns the full film record with availability information for the authenticated exhibitor's territories.

**Auth**: Bearer token (required)  
**Account type**: Exhibitor only

---

### URL Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `filmId` | uuid | Film unique identifier |

---

### Response 200

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "title": "Le Mépris",
    "originalTitle": "Il Disprezzo",
    "releaseYear": 1963,
    "duration": 103,
    "director": "Jean-Luc Godard",
    "cast": ["Brigitte Bardot", "Michel Piccoli", "Jack Palance"],
    "country": "FR",
    "genres": ["drame", "romance"],
    "synopsis": "Durant le tournage de l'Odyssée...",
    "posterUrl": "https://image.tmdb.org/t/p/w500/abc123.jpg",
    "rightsHolderId": "550e8400-e29b-41d4-a716-446655440002",
    "rightsHolderName": "Studiocanal",
    "catalogPriceHt": 150000,
    "demandPriceStartingHt": 180000,
    "hasDemandsEnabled": true,
    "isAvailableInTerritory": true,
    "matchingPriceZones": ["FR", "BE", "CH"],
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-03-20T14:22:00.000Z"
  }
}
```

**Field notes**:
- Same structure as catalog list items
- `isAvailableInTerritory`: Computed based on intersection between film price zones and exhibitor's cinema countries
- `matchingPriceZones`: Country codes where this film can be booked (based on exhibitor's territories)

---

### Errors

| Status | Code | Message | Cause |
|--------|------|---------|-------|
| 401 | `UNAUTHORIZED` | Authentication required | Missing or invalid Bearer token |
| 403 | `FORBIDDEN` | Only exhibitor accounts can access the catalog | Account type is `rights_holder` or `admin` |
| 404 | `NOT_FOUND` | Film not found | Film ID does not exist in database |
| 500 | `INTERNAL_ERROR` | Internal server error | Unhandled exception |

---

### Example

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://timeless.film/api/v1/catalog/550e8400-e29b-41d4-a716-446655440001
```
