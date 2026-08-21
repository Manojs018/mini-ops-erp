# Enabling Location-Restricted Access (Change 4 Guide)

This guide documents the exact, copy-pasteable route modifications required to enable **Location-Restricted Access** across all four modules if requested during Live Verification.

The pre-built, fully unit-tested middleware `restrictToLocation` is located at [`backend/src/middleware/restrictToLocation.ts`](file:///c:/Users/Manoj/OneDrive/Documents/minErp/backend/src/middleware/restrictToLocation.ts).

---

## 1. Inventory Module (`backend/src/modules/inventory/inventory.routes.ts`)

### Import:
```typescript
import { restrictToLocation } from '../../middleware/restrictToLocation';
import { InventoryService } from './inventory.service';
```

### Route Wiring:
```typescript
// GET /inventory/:id -> restrict non-ADMIN users to their assigned location
router.get(
  '/:id',
  authenticate,
  requireRole(['ADMIN', 'OPERATIONS', 'SALES']),
  restrictToLocation(async (req) => {
    const stock = await InventoryService.getInventoryById(req.params.id);
    return stock ? stock.locationId : null;
  }),
  InventoryController.getById
);

// POST /inventory -> restrict creation to user's assigned locationId
router.post(
  '/',
  authenticate,
  requireRole(['ADMIN', 'OPERATIONS']),
  restrictToLocation(async (req) => req.body.locationId || null),
  InventoryController.create
);

// PATCH /inventory/:id/adjust -> restrict adjustment to user's assigned location
router.patch(
  '/:id/adjust',
  authenticate,
  requireRole(['ADMIN', 'OPERATIONS']),
  restrictToLocation(async (req) => {
    const stock = await InventoryService.getInventoryById(req.params.id);
    return stock ? stock.locationId : null;
  }),
  InventoryController.adjust
);

// POST /inventory/:id/report-damage -> restrict damage report to user's assigned location
router.post(
  '/:id/report-damage',
  authenticate,
  requireRole(['ADMIN', 'OPERATIONS']),
  restrictToLocation(async (req) => {
    const stock = await InventoryService.getInventoryById(req.params.id);
    return stock ? stock.locationId : null;
  }),
  InventoryController.reportDamage
);
```

---

## 2. Work Order Module (`backend/src/modules/work-orders/work-order.routes.ts`)

### Import:
```typescript
import { restrictToLocation } from '../../middleware/restrictToLocation';
import { WorkOrderService } from './work-order.service';
```

### Route Wiring:
```typescript
// POST /work-orders -> user must belong to target work order location
router.post(
  '/',
  authenticate,
  requireRole(['ADMIN']),
  restrictToLocation(async (req) => req.body.locationId || null),
  WorkOrderController.create
);

// GET /work-orders/:id -> restrict read to work order location
router.get(
  '/:id',
  authenticate,
  requireRole(['ADMIN', 'OPERATIONS']),
  restrictToLocation(async (req) => {
    const wo = await WorkOrderService.getWorkOrderById(req.params.id);
    return wo ? wo.locationId : null;
  }),
  WorkOrderController.getById
);

// PATCH /work-orders/:id/status -> restrict status transition to work order location
router.patch(
  '/:id/status',
  authenticate,
  requireRole(['ADMIN', 'OPERATIONS']),
  restrictToLocation(async (req) => {
    const wo = await WorkOrderService.getWorkOrderById(req.params.id);
    return wo ? wo.locationId : null;
  }),
  WorkOrderController.updateStatus
);
```

---

## 3. Stock Transfer Module (`backend/src/modules/transfers/transfer.routes.ts`)

> **DESIGN NOTE**: Stock transfers touch two locations (`sourceLocationId` and `destinationLocationId`). The user requesting or dispatching stock must belong to the **source location** (where physical stock is removed from).

### Import:
```typescript
import { restrictToLocation } from '../../middleware/restrictToLocation';
import { TransferService } from './transfer.service';
```

### Route Wiring:
```typescript
// POST /transfers -> user must own source location
router.post(
  '/',
  authenticate,
  requireRole(['ADMIN', 'OPERATIONS']),
  restrictToLocation(async (req) => req.body.sourceLocationId || null),
  TransferController.create
);

// PATCH /transfers/:id/dispatch -> user must own source location
router.patch(
  '/:id/dispatch',
  authenticate,
  requireRole(['ADMIN', 'OPERATIONS']),
  restrictToLocation(async (req) => {
    const transfer = await TransferService.getTransferById(req.params.id);
    return transfer ? transfer.sourceLocationId : null;
  }),
  TransferController.dispatch
);

// PATCH /transfers/:id/receive -> user must own destination location
router.patch(
  '/:id/receive',
  authenticate,
  requireRole(['ADMIN', 'OPERATIONS']),
  restrictToLocation(async (req) => {
    const transfer = await TransferService.getTransferById(req.params.id);
    return transfer ? transfer.destinationLocationId : null;
  }),
  TransferController.receive
);
```

---

## 4. Customer Order Module (`backend/src/modules/orders/order.routes.ts`)

### Import:
```typescript
import { restrictToLocation } from '../../middleware/restrictToLocation';
import { OrderService } from './order.service';
```

### Route Wiring:
```typescript
// POST /orders -> user must belong to location of stock lines being reserved
router.post(
  '/',
  authenticate,
  requireRole(['SALES']),
  restrictToLocation(async (req) => {
    if (!req.body.lines || req.body.lines.length === 0) return null;
    const stock = await InventoryService.getInventoryById(req.body.lines[0].inventoryStockId);
    return stock ? stock.locationId : null;
  }),
  OrderController.create
);
```
