# Mini Operations ERP — Consolidated API Reference & Roles Matrix

This document provides the complete API specification for all endpoints across the **Mini Operations ERP** system.

---

## Standard Error Response Shape

All endpoints across all modules return errors formatted according to a single standard JSON structure:

```json
{
  "error": {
    "message": "Human-readable description of error",
    "statusCode": 400
  }
}
```

### Common HTTP Status Codes:
- `400 Bad Request`: Input validation failed, non-positive quantity, or invalid state machine transition.
- `401 Unauthorized`: Missing, invalid, or expired JWT Bearer token.
- `403 Forbidden`: User role lacks permission for the endpoint, or attempting to view/modify another user's restricted resource.
- `404 Not Found`: Target entity (User, Item, Location, Stock, Transfer, Work Order, Order) does not exist.
- `409 Conflict`: Insufficient physical/available stock, duplicate unique constraint violation, double-receive attempt, or double-cancel attempt.

---

## Role-Based Access Control (RBAC) Matrix

| Module | Endpoint | Method | Allowed Roles | Notes / Restrictions |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `/auth/login` | `POST` | *Public* | Returns JWT token upon valid email/password. |
| **Auth** | `/auth/me` | `GET` | `ADMIN`, `OPERATIONS`, `SALES` | Returns authenticated user profile. |
| **Inventory** | `/inventory` | `GET` | `ADMIN`, `OPERATIONS`, `SALES` | Filterable by `locationId`, `itemId`, `categoryId`, `page`, `limit`. |
| **Inventory** | `/inventory/:id` | `GET` | `ADMIN`, `OPERATIONS`, `SALES` | Single stock row detail with calculated `availableQty`. |
| **Inventory** | `/inventory` | `POST` | `ADMIN`, `OPERATIONS` | Creates initial stock row for `(itemId, locationId, batch)`. |
| **Inventory** | `/inventory/:id/adjust` | `PATCH` | `ADMIN`, `OPERATIONS` | Adjusts physical stock. Guards against falling below `reservedQty`. |
| **Inventory** | `/inventory/:id/report-damage` | `POST` | `ADMIN`, `OPERATIONS` | Reports damaged stock. Decreases `physicalQty` & `availableQty`. |
| **Work Order**| `/work-orders` | `POST` | `ADMIN` | Creates Work Order in `ASSIGNED` status. |
| **Work Order**| `/work-orders` | `GET` | `ADMIN`, `OPERATIONS` | `OPERATIONS` sees assigned orders by default (`?all=true` to override). |
| **Work Order**| `/work-orders/:id` | `GET` | `ADMIN`, `OPERATIONS` | Single Work Order detail. `OPERATIONS` restricted to assigned orders. |
| **Work Order**| `/work-orders/:id/stock-check` | `GET` | `ADMIN`, `OPERATIONS` | Evaluates live material shortage formula `max(0, requiredQty - availableQty)`. |
| **Work Order**| `/work-orders/:id/status` | `PATCH` | `ADMIN`, `OPERATIONS` | Enforces state machine `ASSIGNED -> IN_PROGRESS -> COMPLETED`. |
| **Transfer** | `/transfers` | `POST` | `ADMIN`, `OPERATIONS` | Creates transfer in `REQUESTED` status. Stock untouched. |
| **Transfer** | `/transfers` | `GET` | `ADMIN`, `OPERATIONS`, `SALES` | List transfers with filters and `remainingQty`. |
| **Transfer** | `/transfers/:id` | `GET` | `ADMIN`, `OPERATIONS`, `SALES` | Single transfer detail with `remainingQty`. |
| **Transfer** | `/transfers/:id/dispatch` | `PATCH` | `ADMIN`, `OPERATIONS` | Atomic FIFO stock deduction at source location. |
| **Transfer** | `/transfers/:id/receive` | `PATCH` | `ADMIN`, `OPERATIONS` | Increments destination stock. Accepts optional `{ quantity }` for partial receipt. |
| **Customer Order** | `/orders` | `POST` | `SALES` | Creates order in `RESERVED` status. All-or-nothing multi-line reservation. |
| **Customer Order** | `/orders` | `GET` | `ADMIN`, `OPERATIONS`, `SALES` | `SALES` sees own orders by default (`?all=true` to override). |
| **Customer Order** | `/orders/:id` | `GET` | `ADMIN`, `OPERATIONS`, `SALES` | Single order detail. `SALES` restricted to own orders (`403` otherwise). |
| **Customer Order** | `/orders/:id/cancel` | `PATCH` | `ADMIN`, `SALES` | Releases reserved stock. `SALES` restricted to own orders; `ADMIN` any. |

---

## Detailed Endpoint Specifications

### 1. Authentication Module

#### `POST /auth/login`
- **Body**:
  ```json
  {
    "email": "ops@minerp.local",
    "password": "password123"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-uuid",
      "name": "Operations Manager",
      "email": "ops@minerp.local",
      "role": "OPERATIONS",
      "locationId": "loc-uuid"
    }
  }
  ```

---

### 2. Inventory Module

#### `GET /inventory`
- **Query Params**: `locationId`, `itemId`, `categoryId`, `page` (default 1), `limit` (default 10)
- **Response (`200 OK`)**:
  ```json
  {
    "data": [
      {
        "id": "stock-uuid",
        "itemId": "item-uuid",
        "locationId": "loc-uuid",
        "batch": "BATCH-2026-001",
        "physicalQty": 100,
        "reservedQty": 20,
        "availableQty": 80,
        "version": 1,
        "item": { "id": "item-uuid", "sku": "SKU-BEARING-01", "name": "Industrial Bearing" },
        "location": { "id": "loc-uuid", "name": "Main Warehouse Alpha" }
      }
    ],
    "pagination": { "total": 1, "page": 1, "limit": 10, "totalPages": 1 }
  }
  ```

#### `POST /inventory/:id/report-damage`
- **Headers**: `Authorization: Bearer <JWT>`
- **Body**:
  ```json
  {
    "quantity": 15,
    "reason": "Forklift collision damage"
  }
  ```
- **Response (`200 OK`)**: Updated stock row showing `physicalQty` reduced by 15, `availableQty` reduced by 15.

---

### 3. Work Order Module

#### `POST /work-orders`
- **Headers**: `Authorization: Bearer <ADMIN_JWT>`
- **Body**:
  ```json
  {
    "locationId": "loc-uuid",
    "itemId": "item-uuid",
    "requiredQty": 50,
    "assignedUserId": "ops-user-uuid"
  }
  ```
- **Response (`201 Created`)**: Status `ASSIGNED`, embedded `stockCheck` displaying `availableQtyAtLocation` and `shortage`.

---

### 4. Stock Transfer Module

#### `POST /transfers`
- **Headers**: `Authorization: Bearer <JWT>`
- **Body**:
  ```json
  {
    "sourceLocationId": "loc-source-uuid",
    "destinationLocationId": "loc-dest-uuid",
    "itemId": "item-uuid",
    "quantity": 100
  }
  ```
- **Response (`201 Created`)**: Status `REQUESTED`, `receivedQty: 0`, `remainingQty: 100`.

#### `PATCH /transfers/:id/receive`
- **Headers**: `Authorization: Bearer <JWT>`
- **Body** (Optional):
  ```json
  {
    "quantity": 40
  }
  ```
- **Response (`200 OK`)**: Status `PARTIALLY_RECEIVED` (or `RECEIVED` if fully received), `receivedQty: 40`, `remainingQty: 60`.

---

### 5. Customer Order Module

#### `POST /orders`
- **Headers**: `Authorization: Bearer <SALES_JWT>`
- **Body**:
  ```json
  {
    "customerName": "Acme Industrial Corp",
    "lines": [
      {
        "inventoryStockId": "stock-uuid-1",
        "quantity": 20
      }
    ]
  }
  ```
- **Response (`201 Created`)**: Status `RESERVED`, all-or-nothing multi-line reservation completed.
