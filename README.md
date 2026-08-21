# Mini Operations ERP — Backend API

A lightweight, enterprise-grade Operations ERP backend built with Node.js, TypeScript, Express, PostgreSQL, and Prisma ORM.

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

### Role & Access Authorization Rules

| Endpoint | Method | Allowed Roles | Restrictions / Notes |
| :--- | :--- | :--- | :--- |
| `/transfers` | `POST` | `ADMIN`, `OPERATIONS` | Creates transfer in `REQUESTED` status. Source != Destination. Stock untouched. |
| `/transfers` | `GET` | `ADMIN`, `OPERATIONS`, `SALES` | Filterable by `?status=`, `?sourceLocationId=`, `?destinationLocationId=`, `?itemId=`, `page`, `limit`. |
| `/transfers/:id` | `GET` | `ADMIN`, `OPERATIONS`, `SALES` | Single transfer detail with joined location and item data. |
| `/transfers/:id/dispatch` | `PATCH` | `ADMIN`, `OPERATIONS` | Atomic FIFO stock deduction at source. 409 Conflict on shortage. Destination untouched. |
| `/transfers/:id/receive` | `PATCH` | `ADMIN`, `OPERATIONS` | Atomic stock increment at destination. 409 Conflict on double-receive attempts. |

---

## Work Order Module (Phase 4)

The Work Order module enables creation, tracking, and management of internal manufacturing and processing jobs.

> **IMPORTANT**: Work Orders in Phase 4 **DO NOT RESERVE STOCK**. Work Orders only check material availability and report live stock shortages (`max(0, requiredQty - availableQtyAtLocation)`). Stock reservation is introduced in Phase 5 (Customer Orders) using the atomic `reserveStock()` engine built in Phase 3.

---

### Work Order Status State Machine

Work Orders follow a strict, uni-directional state machine:

```text
[ ASSIGNED ]  ------->  [ IN_PROGRESS ]  ------->  [ COMPLETED ]
```

#### State Transition Rules:
1. **`ASSIGNED` -> `IN_PROGRESS`**: Allowed. Work has commenced.
2. **`IN_PROGRESS` -> `COMPLETED`**: Allowed. Work is physically finished.
3. **`ASSIGNED` -> `COMPLETED`**: **REJECTED (400 Bad Request)**. Work Orders must pass through `IN_PROGRESS`.
4. **Any -> `ASSIGNED`**: **REJECTED (400 Bad Request)**. Status cannot transition backward.
5. **`COMPLETED` -> Any**: **REJECTED (400 Bad Request)**. `COMPLETED` is a terminal state.

---

### Material Availability & Shortage Calculation Formula

$$\text{availableQtyAtLocation} = \sum (\text{physicalQty} - \text{reservedQty}) \quad \text{for all batches at location}$$

$$\text{shortage} = \max(0, \, \text{requiredQty} - \text{availableQtyAtLocation})$$

---

### API Endpoints & Payload Specifications

#### 1. Create Stock Transfer (`POST /transfers`)
- **Headers**: `Authorization: Bearer <JWT>`
- **Request Body**:
  ```json
  {
    "sourceLocationId": "loc-source-uuid",
    "destinationLocationId": "loc-dest-uuid",
    "itemId": "item-uuid-123",
    "quantity": 40
  }
  ```
- **Response (`201 Created`)**: Status `REQUESTED`.

#### 2. Dispatch Stock Transfer (`PATCH /transfers/:id/dispatch`)
- **Headers**: `Authorization: Bearer <JWT>`
- **Response (`200 OK`)**: Status updated to `DISPATCHED`, `dispatchedAt` set, source `physicalQty` reduced.

#### 3. Receive Stock Transfer (`PATCH /transfers/:id/receive`)
- **Headers**: `Authorization: Bearer <JWT>`
- **Response (`200 OK`)**: Status updated to `RECEIVED`, `receivedAt` set, destination `physicalQty` increased.
