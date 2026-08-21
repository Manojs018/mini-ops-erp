import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/prisma';
import { InventoryService } from './inventory.service';
import { ReferenceType } from '@prisma/client';

// Mock Prisma Client with synchronous transaction execution in factory closure
jest.mock('../../config/prisma', () => {
  const mockPrismaClient: any = {
    inventoryStock: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    item: {
      findUnique: jest.fn(),
    },
    location: {
      findUnique: jest.fn(),
    },
    inventoryTransaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  mockPrismaClient.$transaction = jest.fn((cb: any) => cb(mockPrismaClient));

  return { prisma: mockPrismaClient };
});

describe('Inventory Module Unit & API Endpoint Tests', () => {
  const mockAdminUser = {
    id: 'user-admin-id-123',
    name: 'Admin User',
    email: 'admin@minerp.local',
    role: 'ADMIN',
  };

  const mockSalesUser = {
    id: 'user-sales-id-789',
    name: 'Sales User',
    email: 'sales@minerp.local',
    role: 'SALES',
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
      sku: 'SKU-001',
      name: 'Test Item 1',
      category: { id: 'cat-id-1', name: 'Electronics' },
    },
    location: {
      id: 'loc-id-1',
      name: 'Warehouse A',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure $transaction implementation is preserved across clearAllMocks
    (prisma.$transaction as jest.Mock).mockImplementation((cb: any) => cb(prisma));
  });

  describe('GET /inventory (List & availableQty calculation)', () => {
    it('should calculate availableQty dynamically as physicalQty - reservedQty', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.inventoryStock.count as jest.Mock).mockResolvedValue(1);
      (prisma.inventoryStock.findMany as jest.Mock).mockResolvedValue([mockStockRecord]);

      const result = await InventoryService.listInventory({});

      expect(result.data[0]).toHaveProperty('availableQty', 80); // 100 - 20 = 80
      expect(result.data[0].physicalQty).toBe(100);
      expect(result.data[0].reservedQty).toBe(20);
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
      (prisma.inventoryStock.findUnique as jest.Mock).mockResolvedValue(mockStockRecord);

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
      (prisma.inventoryStock.findUnique as jest.Mock).mockResolvedValue(mockStockRecord);

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

  describe('Idempotency Behavior (releaseStock)', () => {
    it('should return existing record without double-releasing when idempotencyKey is reused', async () => {
      const idempotencyKey = 'unique-idempotency-key-123';

      (prisma.inventoryTransaction.findUnique as jest.Mock).mockResolvedValue({
        id: 'tx-1',
        inventoryStockId: 'stock-id-100',
        idempotencyKey,
        type: 'RELEASE',
      });

      (prisma.inventoryStock.findUnique as jest.Mock).mockResolvedValue(mockStockRecord);

      const res1 = await InventoryService.releaseStock(
        'stock-id-100',
        10,
        ReferenceType.WORK_ORDER,
        'WO-101',
        idempotencyKey
      );

      const res2 = await InventoryService.releaseStock(
        'stock-id-100',
        10,
        ReferenceType.WORK_ORDER,
        'WO-101',
        idempotencyKey
      );

      expect(res1.id).toBe(mockStockRecord.id);
      expect(res2.id).toBe(mockStockRecord.id);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });
});
