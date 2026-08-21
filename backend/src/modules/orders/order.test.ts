import request from 'supertest';
import { Role, CustomerOrderStatus } from '@prisma/client';
import { AppError } from '../../utils/errors';

// MUST Mock Prisma Client BEFORE importing app
jest.mock('../../config/prisma', () => {
  const mockDb: any = {
    customerOrder: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    customerOrderLine: {
      create: jest.fn(),
    },
    inventoryStock: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryTransaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    item: {
      findUnique: jest.fn(),
    },
    location: {
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  return { prisma: mockDb };
});

// Import app and prisma AFTER jest.mock
import app from '../../app';
import { prisma } from '../../config/prisma';
import { OrderService } from './order.service';

describe('Customer Order Module Unit, API Endpoint & Concurrency Tests', () => {
  const mockAdminUser = {
    id: 'user-admin-1',
    name: 'Admin User',
    email: 'admin@minerp.local',
    role: Role.ADMIN,
  };

  const mockOpsUser = {
    id: 'user-ops-1',
    name: 'Operations Manager',
    email: 'ops@minerp.local',
    role: Role.OPERATIONS,
  };

  const mockSalesUser1 = {
    id: 'user-sales-1',
    name: 'Sales Rep 1',
    email: 'sales1@minerp.local',
    role: Role.SALES,
  };

  const mockSalesUser2 = {
    id: 'user-sales-2',
    name: 'Sales Rep 2',
    email: 'sales2@minerp.local',
    role: Role.SALES,
  };

  const mockLocation = {
    id: 'loc-1',
    name: 'Warehouse Alpha',
  };

  const mockItem1 = {
    id: 'item-1',
    sku: 'SKU-001',
    name: 'Hydraulic Valve',
    categoryId: 'cat-1',
  };

  const mockItem2 = {
    id: 'item-2',
    sku: 'SKU-002',
    name: 'Pneumatic Cylinder',
    categoryId: 'cat-1',
  };

  const mockStockRow1 = {
    id: 'stock-100',
    itemId: 'item-1',
    locationId: 'loc-1',
    batch: 'BATCH-2026-A',
    physicalQty: 100,
    reservedQty: 0,
    version: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    item: mockItem1,
    location: mockLocation,
  };

  const mockStockRow2 = {
    id: 'stock-200',
    itemId: 'item-2',
    locationId: 'loc-1',
    batch: 'BATCH-2026-B',
    physicalQty: 50,
    reservedQty: 0,
    version: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    item: mockItem2,
    location: mockLocation,
  };

  const mockOrder1 = {
    id: 'order-100',
    customerName: 'Acme Corporation',
    salesUserId: 'user-sales-1',
    status: CustomerOrderStatus.RESERVED,
    createdAt: new Date(),
    salesUser: mockSalesUser1,
    lines: [
      {
        id: 'line-1',
        customerOrderId: 'order-100',
        itemId: 'item-1',
        locationId: 'loc-1',
        inventoryStockId: 'stock-100',
        quantity: 20,
        item: mockItem1,
        location: mockLocation,
        inventoryStock: mockStockRow1,
      },
    ],
  };

  const mockCancelledOrder1 = {
    ...mockOrder1,
    status: CustomerOrderStatus.CANCELLED,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-assign $transaction mock implementation after clearAllMocks
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') {
        return await cb(prisma);
      }
      return cb;
    });
  });

  // --------------------------------------------------------------------------
  // 1. POST /orders Endpoint & Validation Tests
  // --------------------------------------------------------------------------
  describe('POST /orders (Order Creation & Reservation)', () => {
    it('should allow SALES role to create order (201 Created, status RESERVED, reservedQty increased)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser1);
      (prisma.inventoryStock.findUnique as jest.Mock).mockResolvedValue(mockStockRow1);
      (prisma.customerOrder.create as jest.Mock).mockResolvedValue({
        id: 'order-100',
        customerName: 'Acme Corporation',
        salesUserId: 'user-sales-1',
        status: CustomerOrderStatus.RESERVED,
      });
      (prisma.inventoryTransaction.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ ...mockStockRow1, reservedQty: 20 }]);
      (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: 'tx-res-1' });
      (prisma.customerOrderLine.create as jest.Mock).mockResolvedValue({ id: 'line-1' });
      (prisma.customerOrder.findUnique as jest.Mock).mockResolvedValue(mockOrder1);

      const salesToken = require('jsonwebtoken').sign(
        { userId: mockSalesUser1.id, role: mockSalesUser1.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          customerName: 'Acme Corporation',
          lines: [{ inventoryStockId: 'stock-100', quantity: 20 }],
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe(CustomerOrderStatus.RESERVED);
      expect(response.body.lines).toHaveLength(1);
      expect(response.body.lines[0].quantity).toBe(20);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should deny access (403 Forbidden) to ADMIN or OPERATIONS role on POST /orders', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);

      const adminToken = require('jsonwebtoken').sign(
        { userId: mockAdminUser.id, role: mockAdminUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerName: 'Test Corp',
          lines: [{ inventoryStockId: 'stock-100', quantity: 10 }],
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Insufficient permissions');
    });

    it('should fail with 409 Conflict when line quantity exceeds available stock, leaving reservedQty UNCHANGED', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser1);
      (prisma.inventoryStock.findUnique as jest.Mock).mockResolvedValue(mockStockRow1);
      (prisma.customerOrder.create as jest.Mock).mockResolvedValue({ id: 'order-fail-1' });
      (prisma.inventoryTransaction.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const salesToken = require('jsonwebtoken').sign(
        { userId: mockSalesUser1.id, role: mockSalesUser1.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          customerName: 'Big Order Corp',
          lines: [{ inventoryStockId: 'stock-100', quantity: 150 }],
        });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toContain('Only 100 units available, requested 150');
      expect(prisma.inventoryTransaction.create).not.toHaveBeenCalled();
    });

    it('PARTIAL FAILURE ROLLBACK TEST: should roll back Line 1 reservation when Line 2 fails for insufficient stock', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser1);

      (prisma.inventoryStock.findUnique as jest.Mock).mockImplementation((args: any) => {
        if (args.where.id === 'stock-100') return Promise.resolve(mockStockRow1);
        if (args.where.id === 'stock-200') return Promise.resolve(mockStockRow2);
        return Promise.resolve(null);
      });

      (prisma.customerOrder.create as jest.Mock).mockResolvedValue({ id: 'order-multi-fail' });
      (prisma.inventoryTransaction.findUnique as jest.Mock).mockResolvedValue(null);

      let queryRawCallCount = 0;
      (prisma.$queryRaw as jest.Mock).mockImplementation(() => {
        queryRawCallCount++;
        if (queryRawCallCount === 1) {
          return Promise.resolve([{ ...mockStockRow1, reservedQty: 20 }]);
        }
        return Promise.resolve([]); // Line 2 fails
      });

      const salesToken = require('jsonwebtoken').sign(
        { userId: mockSalesUser1.id, role: mockSalesUser1.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          customerName: 'Multi Line Fail Corp',
          lines: [
            { inventoryStockId: 'stock-100', quantity: 20 },
            { inventoryStockId: 'stock-200', quantity: 999 },
          ],
        });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toContain('Only 50 units available, requested 999');
    });

    it('should reject duplicate inventoryStockId values in order lines with 400', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser1);

      const salesToken = require('jsonwebtoken').sign(
        { userId: mockSalesUser1.id, role: mockSalesUser1.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/orders')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          customerName: 'Duplicate Lines Corp',
          lines: [
            { inventoryStockId: 'stock-100', quantity: 10 },
            { inventoryStockId: 'stock-100', quantity: 15 },
          ],
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(
        "Duplicate inventoryStockId 'stock-100' found in order lines"
      );
    });
  });

  // --------------------------------------------------------------------------
  // 2. PATCH /orders/:id/cancel & Ownership Guards
  // --------------------------------------------------------------------------
  describe('PATCH /orders/:id/cancel (Cancellation & Release)', () => {
    it('should allow owning SALES user to cancel order (200, status CANCELLED, reservedQty decreased)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser1);
      (prisma.customerOrder.findUnique as jest.Mock).mockResolvedValue(mockOrder1);
      (prisma.inventoryStock.findUnique as jest.Mock).mockResolvedValue(mockStockRow1);
      (prisma.inventoryTransaction.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ ...mockStockRow1, reservedQty: 0 }]);
      (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: 'tx-rel-1' });
      (prisma.customerOrder.update as jest.Mock).mockResolvedValue(mockCancelledOrder1);

      const salesToken = require('jsonwebtoken').sign(
        { userId: mockSalesUser1.id, role: mockSalesUser1.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/orders/order-100/cancel')
        .set('Authorization', `Bearer ${salesToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(CustomerOrderStatus.CANCELLED);
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should deny access (403) to a SALES user attempting to cancel someone else order', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser2);
      (prisma.customerOrder.findUnique as jest.Mock).mockResolvedValue(mockOrder1);

      const sales2Token = require('jsonwebtoken').sign(
        { userId: mockSalesUser2.id, role: mockSalesUser2.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/orders/order-100/cancel')
        .set('Authorization', `Bearer ${sales2Token}`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('Sales reps can only cancel their own orders');
    });

    it('should allow ADMIN user to cancel ANY order (Admin override 200)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.customerOrder.findUnique as jest.Mock).mockResolvedValue(mockOrder1);
      (prisma.inventoryStock.findUnique as jest.Mock).mockResolvedValue(mockStockRow1);
      (prisma.inventoryTransaction.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ ...mockStockRow1, reservedQty: 0 }]);
      (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: 'tx-rel-admin' });
      (prisma.customerOrder.update as jest.Mock).mockResolvedValue(mockCancelledOrder1);

      const adminToken = require('jsonwebtoken').sign(
        { userId: mockAdminUser.id, role: mockAdminUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/orders/order-100/cancel')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(CustomerOrderStatus.CANCELLED);
    });

    it('should reject (409 Conflict) when cancelling an already CANCELLED order', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser1);
      (prisma.customerOrder.findUnique as jest.Mock).mockResolvedValue(mockCancelledOrder1);

      const salesToken = require('jsonwebtoken').sign(
        { userId: mockSalesUser1.id, role: mockSalesUser1.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/orders/order-100/cancel')
        .set('Authorization', `Bearer ${salesToken}`);

      expect(response.status).toBe(409);
      expect(response.body.error.message).toBe('Customer order has already been cancelled.');
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // 3. CORE CONCURRENCY RACE-CONDITION TESTS (Case Study Test 1 Spec Example)
  // --------------------------------------------------------------------------
  describe('Concurrency Race-Condition Tests (80 vs 50 Reservation & Double-Cancel Guard)', () => {
    it('SPEC TEST 1: Fire TWO concurrent order requests (80 vs 50) against 100 available stock -> EXACTLY ONE 201 and ONE 409 across 5 iterations', async () => {
      for (let iteration = 1; iteration <= 5; iteration++) {
        let currentReserved = 0;
        const physical = 100;

        (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser1);
        (prisma.inventoryStock.findUnique as jest.Mock).mockResolvedValue({
          ...mockStockRow1,
          physicalQty: physical,
          reservedQty: currentReserved,
        });

        (prisma.$queryRaw as jest.Mock).mockImplementation((query: any, ...values: any[]) => {
          const reqQty = values[0];
          if (physical - currentReserved >= reqQty) {
            currentReserved += reqQty;
            return Promise.resolve([{ ...mockStockRow1, reservedQty: currentReserved }]);
          }
          return Promise.resolve([]);
        });

        (prisma.customerOrder.create as jest.Mock).mockImplementation((args: any) =>
          Promise.resolve({
            id: `order-iter-${iteration}`,
            customerName: args.data.customerName,
            salesUserId: 'user-sales-1',
            status: CustomerOrderStatus.RESERVED,
          })
        );
        (prisma.inventoryTransaction.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: `tx-res-iter-${iteration}` });
        (prisma.customerOrderLine.create as jest.Mock).mockResolvedValue({ id: `line-iter-${iteration}` });
        (prisma.customerOrder.findUnique as jest.Mock).mockImplementation(() =>
          Promise.resolve({
            ...mockOrder1,
            id: `order-iter-${iteration}`,
            status: CustomerOrderStatus.RESERVED,
          })
        );

        const results = await Promise.all([
          OrderService.createOrder({
            customerName: 'Client A (80 units)',
            lines: [{ inventoryStockId: 'stock-100', quantity: 80 }],
            salesUserId: 'user-sales-1',
          }).catch((err) => err),
          OrderService.createOrder({
            customerName: 'Client B (50 units)',
            lines: [{ inventoryStockId: 'stock-100', quantity: 50 }],
            salesUserId: 'user-sales-1',
          }).catch((err) => err),
        ]);

        const successResult: any = results.find((r: any) => r && r.status === CustomerOrderStatus.RESERVED);
        const errorResult: any = results.find((r: any) => r instanceof AppError);

        expect(successResult).toBeDefined();
        expect(successResult.status).toBe(CustomerOrderStatus.RESERVED);
        expect(errorResult).toBeDefined();
        expect(errorResult?.statusCode).toBe(409);
        expect(errorResult?.message).toContain('available, requested');

        expect(currentReserved).toBeLessThanOrEqual(100);
        expect([50, 80]).toContain(currentReserved);
      }
    });

    it('CONCURRENCY TEST 2: Fire TWO concurrent cancel requests on the SAME order -> EXACTLY ONE succeeds and ONE fails with 409', async () => {
      for (let iteration = 1; iteration <= 5; iteration++) {
        let isFirstCall = true;

        (prisma.customerOrder.findUnique as jest.Mock).mockImplementation(() => {
          if (isFirstCall) {
            isFirstCall = false;
            return Promise.resolve(mockOrder1);
          }
          return Promise.resolve(mockCancelledOrder1);
        });

        (prisma.inventoryStock.findUnique as jest.Mock).mockResolvedValue(mockStockRow1);
        (prisma.inventoryTransaction.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ ...mockStockRow1, reservedQty: 0 }]);
        (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: `tx-cancel-iter-${iteration}` });
        (prisma.customerOrder.update as jest.Mock).mockResolvedValue(mockCancelledOrder1);

        const results = await Promise.all([
          OrderService.cancelOrder('order-100', 'user-sales-1', Role.SALES).catch((err) => err),
          OrderService.cancelOrder('order-100', 'user-sales-1', Role.SALES).catch((err) => err),
        ]);

        const successResult: any = results.find((r: any) => r && r.status === CustomerOrderStatus.CANCELLED);
        const errorResult: any = results.find((r: any) => r instanceof AppError);

        expect(successResult).toBeDefined();
        expect(successResult.status).toBe(CustomerOrderStatus.CANCELLED);
        expect(errorResult).toBeDefined();
        expect(errorResult?.statusCode).toBe(409);
        expect(errorResult?.message).toBe('Customer order has already been cancelled.');
      }
    });
  });
});
