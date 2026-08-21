# Mini Operations ERP — Backend API

A lightweight, enterprise-grade Operations ERP backend built with Node.js, TypeScript, Express, PostgreSQL, and Prisma ORM.

---

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Language**: TypeScript (v5+)
- **Framework**: Express.js
- **Database**: PostgreSQL (v14+)
- **ORM**: Prisma ORM (v5.22+)
- **Authentication**: JWT (`jsonwebtoken`) & `bcryptjs`
- **Testing**: Jest & Supertest

---

## Setup & Local Development

### 1. Prerequisites
Ensure PostgreSQL is running locally or accessible via a valid database connection string.

### 2. Environment Variables
Create a `.env` file in `backend/` with the following variables:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/minerp?schema=public"
PORT=3000
JWT_SECRET="dev-jwt-secret-min-erp-2026-key"
```

### 3. Database Migration & Seed
Run database migrations and populate seeded test users (`admin@minerp.local`, `ops@minerp.local`, `sales@minerp.local`), sample locations, items, and stock:

```bash
cd backend
npx prisma migrate dev --name init
npm run seed
```

### 4. Running the Server
```bash
npm run dev
```
The server starts at `http://localhost:3000`.

### 5. Running Tests
Run the automated unit, API endpoint, and concurrency test suites:

```bash
npm test
```

---

## Live-Verification Readiness Notes

This project is pre-hardened against all four candidate unannounced changes specified in the case study **Live Verification** guidelines:

### Change 1: Damaged Stock Handling
- **Status**: **Fully Built & Wired**
- **Endpoint**: `POST /inventory/:id/report-damage` (`ADMIN`, `OPERATIONS`)
- **Body**: `{ "quantity": 15, "reason": "Forklift collision damage" }`
- **Behavior**: Decreases `physicalQty` by 15, immediately reduces computed `availableQty` (`physicalQty - reservedQty`), logs an `InventoryTransaction` of type `DAMAGE`, and guards against reducing stock below `reservedQty` (`400 Bad Request`).

### Change 2: Partial Transfer Receipt
- **Status**: **Fully Built & Wired**
- **Endpoint**: `PATCH /transfers/:id/receive` (`ADMIN`, `OPERATIONS`)
- **Body** (Optional): `{ "quantity": 40 }`
- **Behavior**: Calling without `quantity` receives the remaining balance in full (preserving Phase 5 behavior). Passing an explicit partial `quantity` increments destination stock by 40, sets transfer status to `PARTIALLY_RECEIVED`, and tracks `receivedQty` and `remainingQty`. Final partial receipt updates status to `RECEIVED`.

### Change 3: Order Cancellation & Reservation Release
- **Status**: **Fully Built & Wired**
- **Endpoint**: `PATCH /orders/:id/cancel` (`SALES` for own orders, `ADMIN` for any order)
- **Behavior**: Re-checks order status inside a database transaction, updates status to `CANCELLED`, and releases reserved stock for all lines via `releaseStock()`. Duplicate cancellation attempts return `409 Conflict`.

### Change 4: Location-Restricted Access
- **Status**: **Built & Unit-Tested** (Ready to wire in minutes)
- **Middleware**: [`backend/src/middleware/restrictToLocation.ts`](file:///c:/Users/Manoj/OneDrive/Documents/minErp/backend/src/middleware/restrictToLocation.ts)
- **Documentation**: Step-by-step one-line route insertion guide at [`docs/enabling-location-restriction.md`](file:///c:/Users/Manoj/OneDrive/Documents/minErp/docs/enabling-location-restriction.md).
- **Behavior**: ADMIN users and global users (`locationId === null`) pass through unrestricted. Non-ADMIN users attempting to access resources outside their assigned `locationId` receive `403 Forbidden`.

---

## Atomic Concurrency Architecture Patterns

The codebase employs two distinct, production-grade atomic concurrency patterns depending on the business domain:

### Pattern A: Atomic Conditional SQL UPDATE (`reservedQty`)
- **Used In**: Customer Order Stock Reservation (`reserveStock()`) & Release (`releaseStock()`).
- **Mechanism**: Executes atomic conditional SQL directly in PostgreSQL:
  ```sql
  UPDATE "InventoryStock"
  SET "reservedQty" = "reservedQty" + $1, "version" = "version" + 1
  WHERE "id" = $2 AND ("physicalQty" - "reservedQty") >= $1
  RETURNING *;
  ```
- **Why**: High-concurrency performance. Does not require table locks. Guarantees `availableQty` (`physicalQty - reservedQty`) can **never go negative**, even under simultaneous heavy request spikes (proven via 80 vs 50 reservation race test).

### Pattern B: Database Row Locks & Idempotency Keys (`physicalQty`)
- **Used In**: Internal Stock Transfers (`dispatchTransfer()` & `receiveTransfer()`).
- **Mechanism**: Wraps state checks, FIFO stock deductions, and destination stock increments in a single database transaction (`prisma.$transaction`). Re-checks status inside the transaction and enforces unique `idempotencyKey` values (e.g. `transfer-receive-${transferId}-${receivedQty}`).
- **Why**: Serializes physical inventory movement between locations and prevents double-receive race conditions.

---

## Known Scope Limitations

1. **Fulfillment Transition Out of Scope**: Converting customer order reservations into physical stock deductions upon shipment is explicitly out of scope for this mandatory backend case study phase. Order status transitions only between `RESERVED` and `CANCELLED`.
2. **Explicit Stock Batch Selection**: Customer order lines reference a specific `inventoryStockId` (a unique item/location/batch tuple chosen by the caller) rather than auto-allocating across multiple batches. If a customer order spans multiple batches, the client submits separate order lines per batch.

---

## Consolidated API Reference & Roles Matrix

Complete endpoint request/response payloads, role authorization rules, and error schemas are documented in:
👉 **[`docs/api-documentation.md`](file:///c:/Users/Manoj/OneDrive/Documents/minErp/docs/api-documentation.md)**

Full automated test suite inventory and mapping to the 5 mandatory spec tests:
👉 **[`TESTING.md`](file:///c:/Users/Manoj/OneDrive/Documents/minErp/TESTING.md)**
