import request from 'supertest';
import { Role, ReferenceType, InventoryTransactionType } from '@prisma/client';

// MUST Mock Prisma Client BEFORE importing app
jest.mock('../../config/prisma', () => {
  const mockDb: any = {
    inventoryStock: {
      count: jest.fn(),
      findMany: jest.fn(),
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
    $transaction: jest.fn(async (cb: any) => {
      if (typeof cb === 'function') {
        return await cb(mockDb);
      }
      return cb;
    }),
    $queryRaw: jest.fn(),
  };

  return { prisma: mockDb };
});

// Import app and prisma AFTER jest.mock
import app from '../../app';
import { prisma } from '../../config/prisma';
import { InventoryService } from './inventory.service';

describe('Inventory Module Unit & API Endpoint Tests', () => {
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

  const mockStockRecord = {
    id: 'stock-id-100',
    itemId: 'item-id-1',
    locationId: 'loc-id-1',
    batch: 'BATCH-2026-001',
    physicalQty: 100,
    reservedQty: 20,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    item: {
      id: 'item-id-1',
      sku: 'SKU-BEARING-01',
      name: 'Industrial Bearing',
      category: {
        id: 'cat-id-1',
        name: 'Bearings',
      },
    },
    location: {
      id: 'loc-id-1',
      name: 'Main Warehouse Alpha',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') {
        return await cb(prisma);
      }
      return cb;
    });
  });

  describe('GET /inventory (List & availableQty calculation)', () => {
    it('should calculate availableQty dynamically as physicalQty - reservedQty', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.inventoryStock.count as jest.Mock).mockResolvedValue(1);
      (prisma.inventoryStock.findMany as jest.Mock).mockResolvedValue([mockStockRecord]);

      const adminToken = require('jsonwebtoken').sign(
        { userId: mockAdminUser.id, role: mockAdminUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .get('/inventory')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);

      const item = response.body.data[0];
      expect(item.physicalQty).toBe(100);
      expect(item.reservedQty).toBe(20);
      expect(item.availableQty).toBe(80); // 100 - 20 = 80
    });
  });

  describe('POST /inventory (Validation & Role Authorization)', () => {
    it('should reject negative physicalQty with 400', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);

      const adminToken = require('jsonwebtoken').sign(
        { userId: mockAdminUser.id, role: mockAdminUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          itemId: 'item-id-1',
          locationId: 'loc-id-1',
          batch: 'BATCH-2026-X',
          physicalQty: -10,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Physical quantity must be a non-negative integer');
    });

    it('should reject duplicate (itemId, locationId, batch) with 409 Conflict', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.item.findUnique as jest.Mock).mockResolvedValue(mockStockRecord.item);
      (prisma.location.findUnique as jest.Mock).mockResolvedValue(mockStockRecord.location);
      (prisma.inventoryStock.findUnique as jest.Mock).mockImplementation(() => Promise.resolve(mockStockRecord));

      const adminToken = require('jsonwebtoken').sign(
        { userId: mockAdminUser.id, role: mockAdminUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/inventory')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          itemId: 'item-id-1',
          locationId: 'loc-id-1',
          batch: 'BATCH-2026-001',
          physicalQty: 50,
        });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toContain('already exists');
    });

    it('should deny access (403) to SALES role on POST /inventory', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser);

      const salesToken = require('jsonwebtoken').sign(
        { userId: mockSalesUser.id, role: mockSalesUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/inventory')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          itemId: 'item-id-1',
          locationId: 'loc-id-1',
          batch: 'BATCH-2026-NEW',
          physicalQty: 50,
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Insufficient permissions');
    });
  });

  describe('PATCH /inventory/:id/adjust (Stock Adjustment Guards)', () => {
    it('should reject adjustment if physicalQty falls below reservedQty (400)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.inventoryStock.findUnique as jest.Mock).mockImplementation(() => Promise.resolve(mockStockRecord));

      const adminToken = require('jsonwebtoken').sign(
        { userId: mockAdminUser.id, role: mockAdminUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/inventory/stock-id-100/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quantityChange: -90,
          reason: 'Mass Damage Writeoff',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('fall below currently reserved quantity');
    });

    it('should deny access (403) to SALES role on PATCH /inventory/:id/adjust', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser);

      const salesToken = require('jsonwebtoken').sign(
        { userId: mockSalesUser.id, role: mockSalesUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/inventory/stock-id-100/adjust')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          quantityChange: 10,
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Insufficient permissions');
    });
  });

  describe('POST /inventory/:id/report-damage (Dedicated Damaged Stock Endpoint)', () => {
    it('should allow OPERATIONS to report damage (200, physicalQty & availableQty reduced, DAMAGE tx logged)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser);
      (prisma.inventoryStock.findUnique as jest.Mock).mockImplementation(() => Promise.resolve(mockStockRecord));
      (prisma.inventoryStock.update as jest.Mock).mockResolvedValue({
        ...mockStockRecord,
        physicalQty: 85, // 100 - 15 = 85
      });
      (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: 'tx-dmg-1' });

      const opsToken = require('jsonwebtoken').sign(
        { userId: mockOpsUser.id, role: mockOpsUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/inventory/stock-id-100/report-damage')
        .set('Authorization', `Bearer ${opsToken}`)
        .send({
          quantity: 15,
          reason: 'Forklift collision damage',
        });

      expect(response.status).toBe(200);
      expect(response.body.physicalQty).toBe(85);
      expect(response.body.reservedQty).toBe(20);
      expect(response.body.availableQty).toBe(65); // 85 - 20 = 65

      expect(prisma.inventoryTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: InventoryTransactionType.DAMAGE,
            quantity: 15,
            referenceId: 'Forklift collision damage',
          }),
        })
      );
    });

    it('should deny access (403) to SALES role on POST /inventory/:id/report-damage', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser);

      const salesToken = require('jsonwebtoken').sign(
        { userId: mockSalesUser.id, role: mockSalesUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/inventory/stock-id-100/report-damage')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          quantity: 5,
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Insufficient permissions');
    });

    it('should reject damage report if quantity exceeds available stock above reserved (400, stock UNCHANGED)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.inventoryStock.findUnique as jest.Mock).mockImplementation(() => Promise.resolve(mockStockRecord));

      const adminToken = require('jsonwebtoken').sign(
        { userId: mockAdminUser.id, role: mockAdminUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/inventory/stock-id-100/report-damage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quantity: 90,
          reason: 'Excessive damage request',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('fall below currently reserved quantity');
      expect(prisma.inventoryStock.update).not.toHaveBeenCalled();
    });

    it('should reject 0 or negative damage quantity with 400 Bad Request', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);

      const adminToken = require('jsonwebtoken').sign(
        { userId: mockAdminUser.id, role: mockAdminUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/inventory/stock-id-100/report-damage')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quantity: 0,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Damaged quantity must be a positive integer');
    });
  });

  describe('Idempotency Behavior (releaseStock)', () => {
    it('should return existing record without double-releasing when idempotencyKey is reused', async () => {
      const mockIdempotencyKey = 'unique-key-123';
      (prisma.inventoryTransaction.findUnique as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        idempotencyKey: mockIdempotencyKey,
      });
      (prisma.inventoryStock.findUnique as jest.Mock).mockImplementation(() => Promise.resolve(mockStockRecord));

      const result = await InventoryService.releaseStock(
        'stock-id-100',
        10,
        ReferenceType.ORDER,
        'order-id-1',
        mockIdempotencyKey
      );

      expect(result.id).toBe('stock-id-100');
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });
});
