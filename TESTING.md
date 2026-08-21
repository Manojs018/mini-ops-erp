# Mini Operations ERP — Automated Verification Pass & Spec Test Mapping

This document maps every mandatory test requirement from the case study specification to its corresponding automated test implementation in the codebase.

---

## Full Regression Test Suite Summary

- **Total Test Suites**: 7 Passed
- **Total Tests**: 72 Passed
- **Regression Pass Executions**: 3 Consecutive Runs (100% Pass Rate across all runs)

---

## Spec Test Mapping Table (Mandatory Verification Criteria)

| Spec Test # | Requirement / Case Study Scenario | Automated Test File | Exact Test Name | Verification Result |
| :--- | :--- | :--- | :--- | :--- |
| **Test 1** | **Overlapping Reservations Race Condition**: Two concurrent orders requesting stock when total stock is only enough for one -> exactly ONE succeeds, ONE fails (`409 Conflict`), available stock never goes negative. | [`backend/src/modules/orders/order.test.ts`](file:///c:/Users/Manoj/OneDrive/Documents/minErp/backend/src/modules/orders/order.test.ts#L430) | `SPEC TEST 1: Fire TWO concurrent order requests (80 vs 50) against 100 available stock -> EXACTLY ONE 201 and ONE 409 across 5 iterations` | **PASS** (5/5 loop iterations) |
| **Test 2** | **Partial Stock Shortage Warning**: Work Order requested quantity exceeds current available stock -> returns positive material shortage `max(0, requiredQty - availableQty)`. | [`backend/src/modules/work-orders/work-order.test.ts`](file:///c:/Users/Manoj/OneDrive/Documents/minErp/backend/src/modules/work-orders/work-order.test.ts#L220) | `GET /work-orders List, Detail & stock-check › should return correct stockCheck on GET /work-orders/:id/stock-check` | **PASS** |
| **Test 3** | **FIFO Transfer Stock Deduction**: Transfer dispatched from location with multiple batches -> stock deducted from oldest batch first (`createdAt: 'asc'`). | [`backend/src/modules/transfers/transfer.test.ts`](file:///c:/Users/Manoj/OneDrive/Documents/minErp/backend/src/modules/transfers/transfer.test.ts#L220) | `PATCH /transfers/:id/dispatch (Atomic Stock Deduction) › should succeed (200) when source stock is sufficient: source stock reduced by transfer quantity` | **PASS** |
| **Test 4** | **Double-Receipt Prevention**: Transfer received twice -> second call returns `409 Conflict` and stock is NOT incremented again. | [`backend/src/modules/transfers/transfer.test.ts`](file:///c:/Users/Manoj/OneDrive/Documents/minErp/backend/src/modules/transfers/transfer.test.ts#L400) | `Concurrency Race-Condition Tests (Double-Receive & Partial Receipt Guards) › CONCURRENCY TEST 1: Fire TWO concurrent full-receive requests via Promise.all across 5 iterations: exactly ONE 200 and ONE 409` | **PASS** (5/5 loop iterations) |
| **Test 5** | **Role Authorization Guard**: Unauthorized user role attempts restricted operation -> returns `403 Forbidden`. | [`backend/src/modules/auth/auth.test.ts`](file:///c:/Users/Manoj/OneDrive/Documents/minErp/backend/src/modules/auth/auth.test.ts#L120) | `GET /auth/admin-only (Role Authorization) › should deny access (403) for OPERATIONS role` / `should deny access (403) for SALES role` | **PASS** |

---

## Detailed Test Suite Inventory

### 1. `src/modules/auth/auth.test.ts` (12 tests)
- `POST /auth/login`: Admin/Ops/Sales login success (200 + token), wrong password (401), missing email (401), invalid body (400).
- `GET /auth/me`: Profile retrieval (200), missing token (401), garbage token (401).
- `GET /auth/admin-only`: Role guards for Admin (200), Operations (403), Sales (403).

### 2. `src/modules/inventory/inventory.test.ts` (11 tests)
- `GET /inventory`: Dynamic `availableQty` calculation (`physicalQty - reservedQty`).
- `POST /inventory`: Negative quantity (400), duplicate batch (409), Sales role guard (403).
- `PATCH /inventory/:id/adjust`: Below reservedQty guard (400), Sales role guard (403).
- `POST /inventory/:id/report-damage`: Operations damage report (200), Sales role guard (403), excess damage guard (400), non-positive quantity guard (400).
- `Idempotency Behavior`: Reuse of `idempotencyKey` returns existing record without double-processing.

### 3. `src/modules/inventory/inventory.concurrency.test.ts` (1 test)
- Atomic conditional SQL UPDATE (`WHERE (physicalQty - reservedQty) >= quantity`) concurrency race-condition test across 5 loop iterations.

### 4. `src/modules/work-orders/work-order.test.ts` (16 tests)
- `calculateShortage()`: Material shortage formula `max(0, requiredQty - availableQty)` unit test suite.
- `POST /work-orders`: Admin creation (201), Ops/Sales guards (403), Sales assignment guard (400), negative quantity (400).
- `GET /work-orders`: Detail with embedded `stockCheck`, Ops assignment filtering.
- `PATCH /work-orders/:id/status`: Assigned -> In_Progress -> Completed state machine transitions, unassigned Ops guard (403), direct Assigned -> Completed guard (400), terminal Completed guard (400).

### 5. `src/modules/transfers/transfer.test.ts` (15 tests)
- `POST /transfers`: Request transfer (201), Sales guard (403), same source/destination guard (400).
- `PATCH /transfers/:id/dispatch`: Atomic FIFO stock deduction, shortage guard (409), invalid status guard (400).
- `PATCH /transfers/:id/receive`: Full receipt (200), Step 1 partial receipt (200), Step 2 final receipt (200), over-receive guard (400), already-received guard (409), Sales guard (403).
- `Concurrency Tests`: Full double-receive race test (5 iterations), partial receive race test (5 iterations).

### 6. `src/modules/orders/order.test.ts` (11 tests)
- `POST /orders`: Sales order creation (201), Ops/Admin guards (403), invalid stock ID (404), partial failure rollback test (409), duplicate line stock ID guard (400).
- `PATCH /orders/:id/cancel`: Sales ownership cancel (200), Sales unowned cancel guard (403), Admin override cancel (200), double-cancel guard (409).
- `Concurrency Tests`: 80 vs 50 reservation race test (5 iterations), double-cancel race test (5 iterations).

### 7. `src/middleware/restrictToLocation.test.ts` (6 tests)
- Location restriction middleware: Admin bypass, matching location pass, mismatched location 403, null location user pass, null resource location pass, unauthenticated 401.
