import request from 'supertest';
import { Role, StockTransferStatus } from '@prisma/client';
import { AppError } from '../../utils/errors';

// MUST Mock Prisma Client BEFORE importing app
jest.mock('../../config/prisma', () => {
  const mockDb: any = {
    stockTransfer: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
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
    $transaction: jest.fn(),
  };

  return { prisma: mockDb };
});

// Import app and prisma AFTER jest.mock
import app from '../../app';
import { prisma } from '../../config/prisma';
import { TransferService } from './transfer.service';

describe('Stock Transfer Module Unit, API Endpoint & Concurrency Tests', () => {
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

  const mockSalesUser = {
    id: 'user-sales-1',
    name: 'Sales Rep',
    email: 'sales@minerp.local',
    role: Role.SALES,
  };

  const mockSourceLocation = {
    id: 'loc-source-1',
    name: 'Source Warehouse A',
  };

  const mockDestLocation = {
    id: 'loc-dest-2',
    name: 'Destination Warehouse B',
  };

  const mockItem = {
    id: 'item-1',
    sku: 'SKU-BEARING-01',
    name: 'Industrial Bearing',
    categoryId: 'cat-1',
  };

  const mockSourceStockRow = {
    id: 'stock-source-100',
    itemId: 'item-1',
    locationId: 'loc-source-1',
    batch: 'BATCH-2026-X',
    physicalQty: 100,
    reservedQty: 0,
    version: 1,
    createdAt: new Date('2026-01-01'),
  };

  const mockRequestedTransfer = {
    id: 'transfer-100',
    sourceLocationId: 'loc-source-1',
    destinationLocationId: 'loc-dest-2',
    itemId: 'item-1',
    quantity: 40,
    receivedQty: 0,
    status: StockTransferStatus.REQUESTED,
    dispatchedAt: null,
    receivedAt: null,
    createdAt: new Date(),
    sourceLocation: mockSourceLocation,
    destinationLocation: mockDestLocation,
    item: mockItem,
  };

  const mockDispatchedTransfer = {
    ...mockRequestedTransfer,
    status: StockTransferStatus.DISPATCHED,
    dispatchedAt: new Date(),
  };

  const mockPartiallyReceivedTransfer = {
    ...mockDispatchedTransfer,
    quantity: 100,
    receivedQty: 40,
    status: StockTransferStatus.PARTIALLY_RECEIVED,
  };

  const mockReceivedTransfer = {
    ...mockDispatchedTransfer,
    quantity: 40,
    receivedQty: 40,
    status: StockTransferStatus.RECEIVED,
    receivedAt: new Date(),
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
  // 1. POST /transfers (Request Transfer Tests)
  // --------------------------------------------------------------------------
  describe('POST /transfers (Request Transfer)', () => {
    it('should allow ADMIN or OPERATIONS to request a transfer (201 Created, status REQUESTED)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.location.findUnique as jest.Mock).mockImplementation((args: any) => {
        if (args.where.id === 'loc-source-1') return Promise.resolve(mockSourceLocation);
        if (args.where.id === 'loc-dest-2') return Promise.resolve(mockDestLocation);
        return Promise.resolve(null);
      });
      (prisma.item.findUnique as jest.Mock).mockResolvedValue(mockItem);
      (prisma.stockTransfer.create as jest.Mock).mockResolvedValue(mockRequestedTransfer);

      const adminToken = require('jsonwebtoken').sign(
        { userId: mockAdminUser.id, role: mockAdminUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sourceLocationId: 'loc-source-1',
          destinationLocationId: 'loc-dest-2',
          itemId: 'item-1',
          quantity: 40,
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe(StockTransferStatus.REQUESTED);
    });

    it('should deny access (403) to SALES role on POST /transfers', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser);

      const salesToken = require('jsonwebtoken').sign(
        { userId: mockSalesUser.id, role: mockSalesUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/transfers')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          sourceLocationId: 'loc-source-1',
          destinationLocationId: 'loc-dest-2',
          itemId: 'item-1',
          quantity: 40,
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Insufficient permissions');
    });

    it('should reject (400) if sourceLocationId === destinationLocationId', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);

      const adminToken = require('jsonwebtoken').sign(
        { userId: mockAdminUser.id, role: mockAdminUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/transfers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          sourceLocationId: 'loc-source-1',
          destinationLocationId: 'loc-source-1',
          itemId: 'item-1',
          quantity: 40,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(
        'Source and destination locations cannot be the same'
      );
    });
  });

  // --------------------------------------------------------------------------
  // 2. PATCH /transfers/:id/dispatch Tests
  // --------------------------------------------------------------------------
  describe('PATCH /transfers/:id/dispatch (Atomic Stock Deduction)', () => {
    it('should fail with 409 Conflict if source stock is insufficient, leaving source stock UNCHANGED', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser);
      (prisma.stockTransfer.findUnique as jest.Mock).mockResolvedValue(mockRequestedTransfer);
      const lowStockRow = { ...mockSourceStockRow, physicalQty: 20 };
      (prisma.inventoryStock.findMany as jest.Mock).mockResolvedValue([lowStockRow]);

      const opsToken = require('jsonwebtoken').sign(
        { userId: mockOpsUser.id, role: mockOpsUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/transfers/transfer-100/dispatch')
        .set('Authorization', `Bearer ${opsToken}`);

      expect(response.status).toBe(409);
      expect(response.body.error.message).toContain('Only 20 units available at source, requested 40');
      expect(prisma.inventoryStock.update).not.toHaveBeenCalled();
    });

    it('should succeed (200) when source stock is sufficient: source stock reduced by transfer quantity, destination stock UNCHANGED', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser);
      (prisma.stockTransfer.findUnique as jest.Mock).mockResolvedValue(mockRequestedTransfer);
      (prisma.inventoryStock.findMany as jest.Mock).mockResolvedValue([mockSourceStockRow]);
      (prisma.stockTransfer.update as jest.Mock).mockResolvedValue(mockDispatchedTransfer);
      (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: 'tx-out-1' });

      const opsToken = require('jsonwebtoken').sign(
        { userId: mockOpsUser.id, role: mockOpsUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/transfers/transfer-100/dispatch')
        .set('Authorization', `Bearer ${opsToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(StockTransferStatus.DISPATCHED);

      expect(prisma.inventoryStock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'stock-source-100' },
          data: expect.objectContaining({
            physicalQty: 60,
          }),
        })
      );

      expect(prisma.inventoryStock.create).not.toHaveBeenCalled();
    });

    it('should reject (400) dispatch on an already DISPATCHED or RECEIVED transfer', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser);
      (prisma.stockTransfer.findUnique as jest.Mock).mockResolvedValue(mockDispatchedTransfer);

      const opsToken = require('jsonwebtoken').sign(
        { userId: mockOpsUser.id, role: mockOpsUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/transfers/transfer-100/dispatch')
        .set('Authorization', `Bearer ${opsToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Transfer cannot be dispatched');
    });
  });

  // --------------------------------------------------------------------------
  // 3. PATCH /transfers/:id/receive Tests & Partial Receipt
  // --------------------------------------------------------------------------
  describe('PATCH /transfers/:id/receive (Full & Partial Receipt)', () => {
    it('should reject (400) receive on a transfer still in REQUESTED status', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser);
      (prisma.stockTransfer.findUnique as jest.Mock).mockResolvedValue(mockRequestedTransfer);

      const opsToken = require('jsonwebtoken').sign(
        { userId: mockOpsUser.id, role: mockOpsUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/transfers/transfer-100/receive')
        .set('Authorization', `Bearer ${opsToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Only DISPATCHED or PARTIALLY_RECEIVED transfers can be received');
    });

    it('should succeed (200) on DISPATCHED transfer (Full Receipt default when no quantity given)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser);
      (prisma.stockTransfer.findUnique as jest.Mock).mockResolvedValue(mockDispatchedTransfer);
      (prisma.inventoryStock.findFirst as jest.Mock).mockResolvedValue(mockSourceStockRow);
      (prisma.inventoryStock.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.inventoryStock.create as jest.Mock).mockResolvedValue({
        id: 'dest-stock-200',
        itemId: 'item-1',
        locationId: 'loc-dest-2',
        batch: 'BATCH-2026-X',
        physicalQty: 40,
        reservedQty: 0,
      });
      (prisma.stockTransfer.update as jest.Mock).mockResolvedValue(mockReceivedTransfer);

      const opsToken = require('jsonwebtoken').sign(
        { userId: mockOpsUser.id, role: mockOpsUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/transfers/transfer-100/receive')
        .set('Authorization', `Bearer ${opsToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(StockTransferStatus.RECEIVED);
      expect(response.body.remainingQty).toBe(0);
    });

    it('PARTIAL RECEIPT STEP 1: receive 40 of 100 -> 200 OK, status PARTIALLY_RECEIVED, remainingQty 60', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser);
      const transfer100 = { ...mockDispatchedTransfer, quantity: 100, receivedQty: 0 };
      (prisma.stockTransfer.findUnique as jest.Mock).mockResolvedValue(transfer100);
      (prisma.inventoryStock.findFirst as jest.Mock).mockResolvedValue(mockSourceStockRow);
      (prisma.inventoryStock.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.inventoryStock.create as jest.Mock).mockResolvedValue({
        id: 'dest-stock-200',
        physicalQty: 40,
      });
      (prisma.stockTransfer.update as jest.Mock).mockResolvedValue({
        ...transfer100,
        receivedQty: 40,
        status: StockTransferStatus.PARTIALLY_RECEIVED,
      });

      const opsToken = require('jsonwebtoken').sign(
        { userId: mockOpsUser.id, role: mockOpsUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/transfers/transfer-100/receive')
        .set('Authorization', `Bearer ${opsToken}`)
        .send({ quantity: 40 });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(StockTransferStatus.PARTIALLY_RECEIVED);
      expect(response.body.receivedQty).toBe(40);
      expect(response.body.remainingQty).toBe(60);

      expect(prisma.inventoryStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            physicalQty: 40,
          }),
        })
      );
    });

    it('PARTIAL RECEIPT STEP 2: receive remaining 60 on PARTIALLY_RECEIVED transfer -> 200 OK, status RECEIVED', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser);
      (prisma.stockTransfer.findUnique as jest.Mock).mockResolvedValue(mockPartiallyReceivedTransfer);
      (prisma.inventoryStock.findFirst as jest.Mock).mockResolvedValue(mockSourceStockRow);
      (prisma.inventoryStock.findUnique as jest.Mock).mockResolvedValue({
        id: 'dest-stock-200',
        physicalQty: 40,
      });
      (prisma.inventoryStock.update as jest.Mock).mockResolvedValue({
        id: 'dest-stock-200',
        physicalQty: 100,
      });
      (prisma.stockTransfer.update as jest.Mock).mockResolvedValue({
        ...mockPartiallyReceivedTransfer,
        receivedQty: 100,
        status: StockTransferStatus.RECEIVED,
        receivedAt: new Date(),
      });

      const opsToken = require('jsonwebtoken').sign(
        { userId: mockOpsUser.id, role: mockOpsUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/transfers/transfer-100/receive')
        .set('Authorization', `Bearer ${opsToken}`)
        .send({ quantity: 60 });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(StockTransferStatus.RECEIVED);
      expect(response.body.receivedQty).toBe(100);
      expect(response.body.remainingQty).toBe(0);

      expect(prisma.inventoryStock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'dest-stock-200' },
          data: expect.objectContaining({
            physicalQty: 100,
          }),
        })
      );
    });

    it('should reject partial receive if quantity > remainingQty (400 Bad Request, stock UNCHANGED)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser);
      (prisma.stockTransfer.findUnique as jest.Mock).mockResolvedValue(mockPartiallyReceivedTransfer);

      const opsToken = require('jsonwebtoken').sign(
        { userId: mockOpsUser.id, role: mockOpsUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/transfers/transfer-100/receive')
        .set('Authorization', `Bearer ${opsToken}`)
        .send({ quantity: 70 });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Only 60 units remain to be received on this transfer');
      expect(prisma.inventoryStock.update).not.toHaveBeenCalled();
    });

    it('should reject (409 Conflict) when receive is called on an already RECEIVED transfer', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser);
      (prisma.stockTransfer.findUnique as jest.Mock).mockResolvedValue(mockReceivedTransfer);

      const opsToken = require('jsonwebtoken').sign(
        { userId: mockOpsUser.id, role: mockOpsUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/transfers/transfer-100/receive')
        .set('Authorization', `Bearer ${opsToken}`);

      expect(response.status).toBe(409);
      expect(response.body.error.message).toBe('Transfer has already been received.');
      expect(prisma.inventoryStock.update).not.toHaveBeenCalled();
    });

    it('should deny access (403) to SALES role on dispatch and receive endpoints', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser);

      const salesToken = require('jsonwebtoken').sign(
        { userId: mockSalesUser.id, role: mockSalesUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const dispatchRes = await request(app)
        .patch('/transfers/transfer-100/dispatch')
        .set('Authorization', `Bearer ${salesToken}`);
      expect(dispatchRes.status).toBe(403);

      const receiveRes = await request(app)
        .patch('/transfers/transfer-100/receive')
        .set('Authorization', `Bearer ${salesToken}`);
      expect(receiveRes.status).toBe(403);
    });
  });

  // --------------------------------------------------------------------------
  // 4. CONCURRENCY RACE-CONDITION TESTS: Double-Receive & Partial Concurrency Guards
  // --------------------------------------------------------------------------
  describe('Concurrency Race-Condition Tests (Double-Receive & Partial Receipt Guards)', () => {
    it('CONCURRENCY TEST 1: Fire TWO concurrent full-receive requests via Promise.all across 5 iterations: exactly ONE 200 and ONE 409', async () => {
      for (let iteration = 1; iteration <= 5; iteration++) {
        let isFirstCall = true;

        (prisma.stockTransfer.findUnique as jest.Mock).mockImplementation(() => {
          if (isFirstCall) {
            isFirstCall = false;
            return Promise.resolve(mockDispatchedTransfer);
          }
          return Promise.resolve(mockReceivedTransfer);
        });

        (prisma.inventoryStock.findFirst as jest.Mock).mockResolvedValue(mockSourceStockRow);
        (prisma.inventoryStock.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.inventoryStock.create as jest.Mock).mockResolvedValue({
          id: `dest-stock-iter-${iteration}`,
          physicalQty: 40,
        });
        (prisma.stockTransfer.update as jest.Mock).mockResolvedValue(mockReceivedTransfer);
        (prisma.inventoryTransaction.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: `tx-rx-${iteration}` });

        const results = await Promise.all([
          TransferService.receiveTransfer('transfer-100'),
          TransferService.receiveTransfer('transfer-100').catch((err) => err),
        ]);

        const successResult: any = results.find((r: any) => r && r.status === StockTransferStatus.RECEIVED);
        const errorResult: any = results.find((r: any) => r instanceof AppError);

        expect(successResult).toBeDefined();
        expect(successResult.status).toBe(StockTransferStatus.RECEIVED);
        expect(errorResult).toBeDefined();
        expect(errorResult?.statusCode).toBe(409);
        expect(errorResult?.message).toBe('Transfer has already been received.');
      }
    });

    it('CONCURRENCY TEST 2: Fire TWO concurrent partial-receive requests for 60 units on a 100-unit transfer -> Total receivedQty NEVER exceeds 100 across 5 iterations', async () => {
      for (let iteration = 1; iteration <= 5; iteration++) {
        const totalTransferQty = 100;
        const baseDispatched = { ...mockDispatchedTransfer, quantity: totalTransferQty, receivedQty: 0 };

        let isFirstCall = true;
        let currentReceived = 0;

        // Simulate PostgreSQL transaction serialization: first caller sees receivedQty=0, second caller sees receivedQty=60
        (prisma.stockTransfer.findUnique as jest.Mock).mockImplementation(() => {
          if (isFirstCall) {
            isFirstCall = false;
          } else {
            currentReceived = 60; // First transaction committed 60 units
          }
          const rec = currentReceived;
          return Promise.resolve({
            ...baseDispatched,
            receivedQty: rec,
            status: rec === 0 ? StockTransferStatus.DISPATCHED : StockTransferStatus.PARTIALLY_RECEIVED,
          });
        });

        (prisma.inventoryStock.findFirst as jest.Mock).mockResolvedValue(mockSourceStockRow);
        (prisma.inventoryStock.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.inventoryStock.create as jest.Mock).mockResolvedValue({ id: 'dest-stock' });
        (prisma.inventoryStock.update as jest.Mock).mockResolvedValue({ id: 'dest-stock' });
        (prisma.inventoryTransaction.findUnique as jest.Mock).mockResolvedValue(null);
        (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: 'tx' });

        (prisma.stockTransfer.update as jest.Mock).mockImplementation((args: any) => {
          currentReceived = args.data.receivedQty;
          return Promise.resolve({
            ...baseDispatched,
            receivedQty: currentReceived,
            status: args.data.status,
          });
        });

        // Fire TWO concurrent partial receive requests for 60 units each (sum 120 > 100)
        const results = await Promise.all([
          TransferService.receiveTransfer('transfer-100', undefined, 60).catch((err) => err),
          TransferService.receiveTransfer('transfer-100', undefined, 60).catch((err) => err),
        ]);

        const successResults = results.filter((r: any) => r && !(r instanceof AppError));
        const errorResults = results.filter((r: any) => r instanceof AppError);

        // One must succeed for 60, and the other must fail with 400 because only 40 remain
        expect(successResults.length).toBe(1);
        expect(errorResults.length).toBe(1);
        expect((errorResults[0] as AppError).statusCode).toBe(400);
        expect((errorResults[0] as AppError).message).toContain('remain to be received');
        expect(currentReceived).toBe(60);
      }
    });
  });
});
