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

  const mockReceivedTransfer = {
    ...mockRequestedTransfer,
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
      // Source stock has physicalQty 20, but transfer requests 40
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
      // Assert source physical stock update was NEVER called
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

      // Assert source physicalQty was reduced by exactly transfer quantity (100 - 40 = 60)
      expect(prisma.inventoryStock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'stock-source-100' },
          data: expect.objectContaining({
            physicalQty: 60,
          }),
        })
      );

      // CRITICAL VERIFICATION: Assert destination stock was NOT created or updated at dispatch time!
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
  // 3. PATCH /transfers/:id/receive Tests & Double-Receive Prevention
  // --------------------------------------------------------------------------
  describe('PATCH /transfers/:id/receive (Atomic Receipt & Double-Receive Guard)', () => {
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
      expect(response.body.error.message).toContain('Only DISPATCHED transfers can be received');
    });

    it('should succeed (200) on DISPATCHED transfer: increments destination physicalQty by transfer quantity', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser);
      (prisma.stockTransfer.findUnique as jest.Mock).mockResolvedValue(mockDispatchedTransfer);
      (prisma.inventoryStock.findFirst as jest.Mock).mockResolvedValue(mockSourceStockRow);
      (prisma.inventoryStock.findUnique as jest.Mock).mockResolvedValue(null); // No existing dest stock
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

      // Assert destination stock created with exact transfer quantity (40) and batch carryover (BATCH-2026-X)
      expect(prisma.inventoryStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itemId: 'item-1',
            locationId: 'loc-dest-2',
            batch: 'BATCH-2026-X',
            physicalQty: 40,
          }),
        })
      );
    });

    it('should reject (409 Conflict) when receive is called a SECOND time on the same transfer', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser);
      // Transfer is already in RECEIVED status
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
      // Assert destination stock was NOT incremented again
      expect(prisma.inventoryStock.update).not.toHaveBeenCalled();
      expect(prisma.inventoryStock.create).not.toHaveBeenCalled();
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
  // 4. CONCURRENCY RACE-CONDITION TEST: Double-Receive Prevention
  // --------------------------------------------------------------------------
  describe('Concurrency Race-Condition Tests (Double-Receive Guard)', () => {
    it('should safely handle concurrent receive requests via Promise.all across 5 iterations: exactly ONE 200 and ONE 409', async () => {
      for (let iteration = 1; iteration <= 5; iteration++) {
        let isFirstCall = true;

        // Simulate atomic status check: first caller sees DISPATCHED, second caller sees RECEIVED
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

        // Fire TWO concurrent receive calls simultaneously using Promise.all
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
  });
});
