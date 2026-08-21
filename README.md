# Mini Operations ERP — Backend API

A lightweight, enterprise-grade Operations ERP backend built with Node.js, TypeScript, Express, PostgreSQL, and Prisma ORM.

---

## Customer Order Module (Phase 6)

The Customer Order module handles customer reservations and order cancellations. It exercises the atomic reservation engine (`reserveStock()` / `releaseStock()`) developed in Phase 3.

---

### Order Status State Machine

Customer Orders follow a 2-state lifecycle in Phase 6:

```text
[ RESERVED ]  ------->  [ CANCELLED ]
```

> **OUT OF SCOPE NOTE**: **Fulfillment (converting a reservation into a physical stock deduction upon shipping)** is explicitly out of scope for this case study's mandatory backend modules and is left as a future extension. Status only transitions `RESERVED` -> `CANCELLED`.

#### State Transition & Reservation Rules:

1. **`POST /orders` (`RESERVED`)**:
   - Role-restricted to **`SALES`** users only.
   - Accepts `customerName` and an array of `lines: [{ inventoryStockId, quantity }]`.
   - **Does NOT move `physicalQty`** and does NOT consume inventory rows.
   - Increases `reservedQty` on the targeted `InventoryStock` rows using Phase 3's atomic `reserveStock()` function.
   - Rejects duplicate `inventoryStockId` values within the same order body (`400 Bad Request`).

2. **`PATCH /orders/:id/cancel` (`CANCELLED`)**:
   - Role-restricted to **`SALES`** (their own orders only) and **`ADMIN`** (any order).
   - Status must be `RESERVED`. Cancelling an already `CANCELLED` order throws `OrderAlreadyCancelledError` (**`409 Conflict`**).
   - Decreases `reservedQty` back to its previous value for every line on the order using Phase 3's `releaseStock()` function.

---

### All-Or-Nothing Multi-Line Reservation Guarantee

In a real-world ERP system, a customer order often consists of multiple line items. If line 1 succeeds in reserving stock but line 2 fails due to insufficient availability, **allowing line 1's reservation to remain active would be disastrous**: it would lock up physical inventory for an incomplete order, create phantom shortages for other buyers, and corrupt inventory integrity.

To guarantee complete atomicity:
1. The entire order creation process (inserting `CustomerOrder` row + `CustomerOrderLine` rows + calling `reserveStock()` for every line + logging `InventoryTransaction` audit rows) is wrapped in a **single, unified database transaction (`prisma.$transaction`)**.
2. If **ANY** line fails with `InsufficientStockError`, the entire transaction rolls back completely — **zero reservations leak into the database**.
3. Proven via unit and endpoint tests ([`order.test.ts`](file:///c:/Users/Manoj/OneDrive/Documents/minErp/backend/src/modules/orders/order.test.ts#L250-L298)), explicitly verifying that when line 2 fails, line 1's `reservedQty` remains 100% unchanged.

---

### Concurrency Serialization & Race-Condition Safety

- **80 vs 50 Overlapping Reservation Race**:
  - Two concurrent `POST /orders` requests (e.g. 80 units vs 50 units) targeting a stock row with 100 available units are executed simultaneously via `Promise.all`.
  - Driven by Phase 3's atomic conditional SQL UPDATE (`UPDATE "InventoryStock" SET "reservedQty" = "reservedQty" + $1 WHERE ("physicalQty" - "reservedQty") >= $1`), **exactly ONE request succeeds (`201 Created`) and ONE fails (`409 Conflict`)**.
  - The final `reservedQty` in the database is guaranteed to be exactly 80 (or 50) — **never 130**.
- **Double-Cancel Race Guard**:
  - Re-checks status inside `prisma.$transaction`. Concurrent `PATCH /cancel` calls result in exactly one successful cancellation (`200 OK`) and one `409 Conflict`, ensuring stock is released **exactly once**.

---

### Role & Access Authorization Rules

| Endpoint | Method | Allowed Roles | Restrictions / Notes |
| :--- | :--- | :--- | :--- |
| `/orders` | `POST` | `SALES` | Creates order in `RESERVED` status. `salesUserId` taken from JWT. All-or-nothing reservation. |
| `/orders` | `GET` | `ADMIN`, `OPERATIONS`, `SALES` | Filterable by `?status=`, `?salesUserId=`, `page`, `limit`. **SALES sees own orders by default unless `?all=true` is passed.** |
| `/orders/:id` | `GET` | `ADMIN`, `OPERATIONS`, `SALES` | Single order detail. SALES restricted to viewing their own orders (`403` otherwise). |
| `/orders/:id/cancel` | `PATCH` | `ADMIN`, `SALES` | Releases reserved stock. **SALES restricted to own orders; ADMIN can cancel any order.** |

---

## Internal Stock Transfer Module (Phase 5)

The Internal Stock Transfer module manages physical inventory movements between different warehouse locations (e.g. main warehouse to distribution center).

---

### Transfer State Machine

Transfers follow a strict 3-phase state machine:

```text
[ REQUESTED ]  ------->  [ DISPATCHED ]  ------->  [ RECEIVED ]
```

#### State Transition & Stock Rules:

1. **`POST /transfers` (`REQUESTED`)**:
   - Records intent to transfer items.
   - **NO inventory stock is checked or moved** at request time.
   - Rejects identical source and destination locations (`400 Bad Request`).
   - Rejects non-positive integer quantities (`400 Bad Request`).

2. **`PATCH /transfers/:id/dispatch` (`DISPATCHED`)**:
   - Status must be `REQUESTED`.
   - **Atomic Stock Deduction**: Queries physical stock at the source location using FIFO order (`createdAt: 'asc'`).
   - If total available physical stock at source is less than transfer quantity, throws `InsufficientStockError` (**`409 Conflict`**) and leaves source inventory **100% UNCHANGED**.
   - If sufficient stock exists, deducts `physicalQty` from source stock rows and creates an `InventoryTransaction` of type `TRANSFER_OUT`.
   - **Destination inventory is NOT touched at dispatch time.**

3. **`PATCH /transfers/:id/receive` (`RECEIVED`)**:
   - Status must be `DISPATCHED`. Rejects `REQUESTED` with `400 Bad Request`.
   - **Atomic Stock Increment & Batch Traceability**: Finds or creates the destination `InventoryStock` record matching `(itemId, destinationLocationId, batch)`, carrying over the exact source batch identifier.
   - Increments `physicalQty` at the destination location by the transfer quantity.
   - Creates an `InventoryTransaction` of type `TRANSFER_IN`.

---

### Double-Receive Prevention & Concurrency Serialization

To satisfy case study Test 4 ("same transfer cannot be received twice"):

1. **Database Row Lock & Status Re-check**:
   - Inside `prisma.$transaction`, `receiveTransfer()` re-queries the transfer row status.
   - If the status is already `RECEIVED`, the transaction immediately aborts and throws `409 Conflict` ("Transfer has already been received.").
2. **Idempotency Key Guard**:
   - Uses `idempotencyKey = transfer-receive-${transferId}`.
   - If a duplicate request arrives concurrently, the database transaction ensures only one invocation updates status to `RECEIVED` while all subsequent concurrent calls fail safely with `409 Conflict`.
   - Proven safe under heavy concurrent load via `Promise.all` race-condition test suite across multiple iterations.

---

## Work Order Module (Phase 4)

The Work Order module enables creation, tracking, and management of internal manufacturing and processing jobs.

> **IMPORTANT**: Work Orders in Phase 4 **DO NOT RESERVE STOCK**. Work Orders only check material availability and report live stock shortages (`max(0, requiredQty - availableQtyAtLocation)`). Stock reservation is introduced in Phase 5/6 (Customer Orders) using the atomic `reserveStock()` engine built in Phase 3.

---

### Work Order Status State Machine

Work Orders follow a strict, uni-directional state machine:

```text
[ ASSIGNED ]  ------->  [ IN_PROGRESS ]  ------->  [ COMPLETED ]
```

---

### Material Availability & Shortage Calculation Formula

$$\text{availableQtyAtLocation} = \sum (\text{physicalQty} - \text{reservedQty}) \quad \text{for all batches at location}$$

$$\text{shortage} = \max(0, \, \text{requiredQty} - \text{availableQtyAtLocation})$$

---

### API Endpoints & Payload Specifications

#### 1. Create Customer Order (`POST /orders`)
- **Headers**: `Authorization: Bearer <SALES_JWT>`
- **Request Body**:
  ```json
  {
    "customerName": "Acme Industrial Corp",
    "lines": [
      {
        "inventoryStockId": "stock-uuid-100",
        "quantity": 20
      },
      {
        "inventoryStockId": "stock-uuid-200",
        "quantity": 10
      }
    ]
  }
  ```
- **Response (`201 Created`)**: Status `RESERVED`, with embedded `lines` and joined item/location details.

#### 2. Cancel Customer Order (`PATCH /orders/:id/cancel`)
- **Headers**: `Authorization: Bearer <JWT>`
- **Response (`200 OK`)**: Status updated to `CANCELLED`, `reservedQty` decreased back for all lines.
