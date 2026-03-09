# Films Analytics API

Analytics endpoint for rights holder accounts to view performance metrics for their catalog.

---

## GET /api/v1/films/analytics

Returns aggregated analytics for all films owned by the authenticated rights holder.

**Auth**: Bearer token (required). Rights holder accounts only.

**Query params**:

| Param    | Type   | Default    | Description                                           |
|----------|--------|------------|-------------------------------------------------------|
| page     | int    | 1          | Page number                                           |
| limit    | int    | 20         | Items per page (max 100)                              |
| sort     | string | `revenue`  | Sort field: `revenue`, `views`, `requests`, `addsToCart` |
| order    | string | `desc`     | Sort order: `asc` or `desc`                           |
| status   | string | —          | Filter by film status (e.g., `active`, `inactive`)    |
| type     | string | —          | Filter by film type (e.g., `direct`, `validation`)    |
| region   | string | —          | Filter by country code (e.g., `US`, `FR`)             |
| period   | string | `30days`   | Time window: `7days`, `30days`, `90days`              |

**Response 200**:

```json
{
  "data": {
    "kpis": {
      "totalViews": 150,
      "totalAddsToCart": 25,
      "totalRequests": 10,
      "totalRevenue": 900000
    },
    "films": [
      {
        "id": "uuid",
        "accountId": "uuid",
        "title": "Film Title",
        "status": "active",
        "type": "direct",
        "countries": ["US", "FR"],
        "views": 50,
        "addsToCart": 8,
        "requests": 3,
        "revenue": 300000,
        "priceZones": [
          { "countries": ["US"], "price": 100000, "currency": "USD" }
        ]
      }
    ],
    "topSearches": [
      { "query": "godard", "count": 15 }
    ],
    "topFilters": [
      { "filters": { "genre": "Drama" }, "count": 10 }
    ],
    "timeline": [
      { "date": "2025-06-01", "views": 12, "revenue": 0 }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

**Errors**:

| Status | Code            | Description                                 |
|--------|-----------------|---------------------------------------------|
| 400    | INVALID_PARAMS  | Invalid query parameters                    |
| 401    | UNAUTHORIZED    | Missing or invalid Bearer token             |
| 403    | FORBIDDEN       | Only rights holder accounts can access      |
| 500    | INTERNAL_ERROR  | Internal server error                       |

**Notes**:

- KPIs are computed across all matching films (not just the paginated page).
- Revenue is in **cents** (integers). Calculated from `order_items.rights_holder_amount`.
- Views and cart additions are tracked via the `film_events` table.
- Timeline returns daily aggregated views and revenue for the selected period.
- Top searches and filters are global (not scoped to the rights holder's films).
