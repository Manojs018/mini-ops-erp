# Mini Operations ERP — Backend API

A lightweight, enterprise-grade Operations ERP backend built with Node.js, TypeScript, Express, PostgreSQL, and Prisma ORM.

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

> **Operational Note on Completion**: Transitioning to `COMPLETED` does **not** block or fail on stock shortage. Completion represents a physical operational confirmation by the Operations user, not a system-gated availability lock.

---

### Material Availability & Shortage Calculation Formula

The material shortage is calculated live on every read:

$$\text{availableQtyAtLocation} = \sum (\text{physicalQty} - \text{reservedQty}) \quad \text{for all batches at location}$$

$$\text{shortage} = \max(0, \, \text{requiredQty} - \text{availableQtyAtLocation})$$

If no `InventoryStock` records exist for the item at the specified location, $\text{availableQtyAtLocation}$ evaluates to $0$, resulting in a full shortage ($\text{shortage} = \text{requiredQty}$).

---

### Role & Access Authorization Rules

| Endpoint | Method | Allowed Roles | Restrictions / Notes |
| :--- | :--- | :--- | :--- |
| `/work-orders` | `POST` | `ADMIN` | Creates Work Order in `ASSIGNED` status. `assignedUserId` must have role `OPERATIONS`. Returns created object with embedded `stockCheck`. |
| `/work-orders` | `GET` | `ADMIN`, `OPERATIONS`, `SALES` | Supports `?status=`, `?locationId=`, `?assignedUserId=`, `page`, `limit`. **OPERATIONS users default to viewing their assigned Work Orders unless `?all=true` is passed.** |
| `/work-orders/:id` | `GET` | `ADMIN`, `OPERATIONS`, `SALES` | Returns Work Order detail with embedded live `stockCheck` object. |
| `/work-orders/:id/stock-check` | `GET` | `ADMIN`, `OPERATIONS`, `SALES` | Returns standalone `{ requiredQty, availableQtyAtLocation, shortage }`. |
| `/work-orders/:id/status` | `PATCH` | `ADMIN`, `OPERATIONS` | **OPERATIONS users can ONLY update Work Orders assigned to them.** `ADMIN` can update any Work Order. Enforces state machine guards. |

---

### API Endpoints & Payload Specifications

#### 1. Create Work Order (`POST /work-orders`)
- **Headers**: `Authorization: Bearer <ADMIN_JWT>`
- **Request Body**:
  ```json
  {
    "locationId": "loc-uuid-123",
    "itemId": "item-uuid-456",
    "requiredQty": 50,
    "assignedUserId": "ops-user-uuid-789"
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "id": "wo-uuid-100",
    "locationId": "loc-uuid-123",
    "itemId": "item-uuid-456",
    "requiredQty": 50,
    "assignedUserId": "ops-user-uuid-789",
    "status": "ASSIGNED",
    "createdAt": "2026-08-21T21:00:00.000Z",
    "location": { "id": "loc-uuid-123", "name": "Warehouse A" },
    "item": { "id": "item-uuid-456", "sku": "SKU-001", "name": "Widget Box" },
    "assignedUser": { "id": "ops-user-uuid-789", "name": "Ops Tech", "email": "ops@minerp.local", "role": "OPERATIONS" },
    "stockCheck": {
      "requiredQty": 50,
      "availableQtyAtLocation": 80,
      "shortage": 0
    }
  }
  ```

#### 2. Get Work Order Stock Check (`GET /work-orders/:id/stock-check`)
- **Headers**: `Authorization: Bearer <JWT>`
- **Response (`200 OK`)**:
  ```json
  {
    "requiredQty": 50,
    "availableQtyAtLocation": 30,
    "shortage": 20
  }
  ```

#### 3. Update Status (`PATCH /work-orders/:id/status`)
- **Headers**: `Authorization: Bearer <JWT>`
- **Request Body**:
  ```json
  {
    "status": "IN_PROGRESS"
  }
  ```
- **Response (`200 OK`)**: Returns updated Work Order object with status `IN_PROGRESS` and live `stockCheck`.
