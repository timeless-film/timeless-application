# Orders & Checkout API

## POST /api/v1/cart/checkout

Create a Stripe Checkout Session for the authenticated exhibitor's cart. Returns a redirect URL to Stripe's hosted checkout page.

**Auth**: Bearer token (required)
**Account type**: Exhibitor only

### Request Body (optional)

| Field    | Type   | Default | Description           |
|----------|--------|---------|-----------------------|
| `locale` | string | `"en"`  | Locale for Stripe UI (`"en"` or `"fr"`) |

### Response 201

```json
{
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
  }
}
```

### Errors

| Status | Code                         | Description                                    |
|--------|------------------------------|------------------------------------------------|
| 400    | `CART_EMPTY`                 | Cart has no items                               |
| 400    | `RIGHTS_HOLDER_NOT_ONBOARDED` | A rights holder hasn't completed Stripe Connect |
| 401    | `UNAUTHORIZED`               | Invalid or missing token                        |
| 403    | `FORBIDDEN`                  | Account is not an exhibitor                     |
| 403    | `TERRITORY_NOT_AVAILABLE`    | Film not available in cinema's territory        |
| 404    | `FILM_NOT_FOUND`             | Film no longer exists                           |
| 404    | `CINEMA_NOT_FOUND`           | Cinema no longer exists                         |
| 404    | `ROOM_NOT_FOUND`             | Room no longer exists                           |
| 409    | `PRICE_CHANGED`              | Prices have changed since items were added      |
| 500    | `STRIPE_ERROR`               | Stripe API error                                |

---

## GET /api/v1/orders

List all orders for the authenticated exhibitor account, sorted by most recent first.

**Auth**: Bearer token (required)
**Account type**: Exhibitor only

### Query Parameters

| Parameter | Type    | Default | Description                                      |
|-----------|---------|---------|--------------------------------------------------|
| `page`    | integer | `1`     | Page number (min: 1)                              |
| `limit`   | integer | `20`    | Items per page (min: 1, max: 100)                 |
| `status`  | enum    | -       | Filter by status: `paid`, `processing`, `delivered`, `refunded` |

### Response 200

```json
{
  "data": [
    {
      "id": "uuid",
      "orderNumber": 42,
      "status": "paid",
      "subtotal": 15000,
      "taxAmount": 3000,
      "total": 18000,
      "currency": "EUR",
      "paidAt": "2026-06-15T10:30:00.000Z",
      "items": [
        {
          "id": "uuid",
          "displayedPrice": 15000,
          "currency": "EUR",
          "film": { "id": "uuid", "title": "Metropolis" },
          "cinema": { "id": "uuid", "name": "Le Grand Rex" }
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3
  }
}
```

### Errors

| Status | Code            | Description                |
|--------|-----------------|----------------------------|
| 400    | `INVALID_INPUT` | Invalid query parameters   |
| 401    | `UNAUTHORIZED`  | Invalid or missing token   |
| 403    | `FORBIDDEN`     | Account is not an exhibitor |

---

## GET /api/v1/orders/:orderId

Get detailed information about a specific order, including all order items with film, cinema, and room details.

**Auth**: Bearer token (required)
**Account type**: Exhibitor only

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `orderId` | UUID | Order ID    |

### Response 200

```json
{
  "data": {
    "id": "uuid",
    "orderNumber": 42,
    "status": "paid",
    "stripePaymentIntentId": "pi_...",
    "subtotal": 15000,
    "taxAmount": 3000,
    "total": 18000,
    "currency": "EUR",
    "taxRate": "0.20",
    "vatNumber": "FR12345678901",
    "reverseCharge": "false",
    "paidAt": "2026-06-15T10:30:00.000Z",
    "items": [
      {
        "id": "uuid",
        "filmId": "uuid",
        "screeningCount": 3,
        "startDate": "2026-07-01",
        "endDate": "2026-07-15",
        "catalogPrice": 12000,
        "displayedPrice": 15000,
        "rightsHolderAmount": 10800,
        "deliveryFees": 500,
        "currency": "EUR",
        "deliveryStatus": "pending",
        "film": { "id": "uuid", "title": "Metropolis", "posterUrl": "https://..." },
        "cinema": { "id": "uuid", "name": "Le Grand Rex" },
        "room": { "id": "uuid", "name": "Salle 1" }
      }
    ]
  }
}
```

### Errors

| Status | Code           | Description                |
|--------|----------------|----------------------------|
| 401    | `UNAUTHORIZED` | Invalid or missing token   |
| 403    | `FORBIDDEN`    | Account is not an exhibitor |
| 404    | `NOT_FOUND`    | Order not found or not owned by account |

---

## GET /api/v1/orders/:orderId/invoice

Get the Stripe-hosted invoice PDF URL for a specific order.

**Auth**: Bearer token (required)
**Account type**: Exhibitor only

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `orderId` | UUID | Order ID    |

### Response 200

```json
{
  "data": {
    "invoiceUrl": "https://pay.stripe.com/invoice/acct_.../pdf",
    "hostedInvoiceUrl": "https://invoice.stripe.com/i/acct_..."
  }
}
```

### Errors

| Status | Code           | Description                                |
|--------|----------------|--------------------------------------------|
| 401    | `UNAUTHORIZED` | Invalid or missing token                   |
| 403    | `FORBIDDEN`    | Account is not an exhibitor                |
| 404    | `NOT_FOUND`    | Order not found, or no invoice available   |
| 500    | `INTERNAL_ERROR` | Failed to retrieve invoice from Stripe   |
