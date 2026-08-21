import request from 'supertest';
import app from '../../app';
import { prisma } from '../../config/prisma';
import { WorkOrderService } from './work-order.service';
import { Role, WorkOrderStatus } from '@prisma/client';

// Mock Prisma Client using factory function closure
jest.mock('../../config/prisma', () => {
  const mockObj: any = {
    workOrder: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryStock: {
      findMany: jest.fn(),
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
  };

  return { prisma: mockObj };
});

describe('Work Order Module Unit & Integration Tests', () => {
  const mockAdminUser = {
    id: 'user-admin-1',
    name: 'Admin User',
    email: 'admin@minerp.local',
    role: Role.ADMIN,
  };

  const mockOpsUser1 = {
    id: 'user-ops-1',
    name: 'Operations Tech 1',
    email: 'ops1@minerp.local',
    role: Role.OPERATIONS,
  };

  const mockOpsUser2 = {
    id: 'user-ops-2',
    name: 'Operations Tech 2',
    email: 'ops2@minerp.local',
    role: Role.OPERATIONS,
  };

  const mockSalesUser = {
    id: 'user-sales-1',
    name: 'Sales Rep 1',
    email: 'sales1@minerp.local',
    role: Role.SALES,
  };

  const mockLocation = {
    id: 'loc-1',
    name: 'Warehouse North',
  };

  const mockItem = {
    id: 'item-1',
    sku: 'SKU-WIDGET-01',
    name: 'Precision Gear',
    categoryId: 'cat-1',
    category: { id: 'cat-1', name: 'Machinery' },
  };

  const mockStockRecord = {
    id: 'stock-1',
    itemId: 'item-1',
    locationId: 'loc-1',
    batch: 'BATCH-2026-A',
    physicalQty: 100,
    reservedQty: 20, // Available = 80
  };

  const mockWorkOrderAssigned = {
    id: 'wo-100',
    locationId: 'loc-1',
    itemId: 'item-1',
    requiredQty: 50,
    assignedUserId: 'user-ops-1',
    status: WorkOrderStatus.ASSIGNED,
    createdAt: new Date(),
    location: mockLocation,
    item: mockItem,
    assignedUser: mockOpsUser1,
  };

  const mockWorkOrderInProgress = {
    ...mockWorkOrderAssigned,
    status: WorkOrderStatus.IN_PROGRESS,
  };

  const mockWorkOrderCompleted = {
    ...mockWorkOrderAssigned,
    status: WorkOrderStatus.COMPLETED,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. calculateShortage() Unit Tests (Pure Function)
  // --------------------------------------------------------------------------
  describe('calculateShortage() Unit Tests', () => {
    it('should return shortage 0 when requiredQty < availableQty', () => {
      const shortage = WorkOrderService.calculateShortage(30, 80);
      expect(shortage).toBe(0);
    });

    it('should return shortage 0 when requiredQty == availableQty', () => {
      const shortage = WorkOrderService.calculateShortage(80, 80);
      expect(shortage).toBe(0);
    });

    it('should return correct positive shortage when requiredQty > availableQty', () => {
      const shortage = WorkOrderService.calculateShortage(120, 80);
      expect(shortage).toBe(40);
    });

    it('should return full requiredQty as shortage when availableQty is 0 (e.g. no stock row)', () => {
      const shortage = WorkOrderService.calculateShortage(50, 0);
      expect(shortage).toBe(50);
    });
  });

  // --------------------------------------------------------------------------
  // 2. POST /work-orders Endpoint Tests
  // --------------------------------------------------------------------------
  describe('POST /work-orders (Creation & Guards)', () => {
    it('should allow ADMIN to create Work Order with valid data (201 + ASSIGNED status + embedded stockCheck)', async () => {
      (prisma.user.findUnique as jest.Mock).mockImplementation((args: any) => {
        if (args.where.id === 'user-admin-1') return Promise.resolve(mockAdminUser);
        if (args.where.id === 'user-ops-1') return Promise.resolve(mockOpsUser1);
        return Promise.resolve(null);
      });
      (prisma.location.findUnique as jest.Mock).mockResolvedValue(mockLocation);
      (prisma.item.findUnique as jest.Mock).mockResolvedValue(mockItem);
      (prisma.workOrder.create as jest.Mock).mockResolvedValue(mockWorkOrderAssigned);
      (prisma.inventoryStock.findMany as jest.Mock).mockResolvedValue([mockStockRecord]);

      const adminToken = require('jsonwebtoken').sign(
        { userId: mockAdminUser.id, role: mockAdminUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/work-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          locationId: 'loc-1',
          itemId: 'item-1',
          requiredQty: 50,
          assignedUserId: 'user-ops-1',
        });

      expect(response.status).toBe(201);
      expect(response.body.status).toBe(WorkOrderStatus.ASSIGNED);
      expect(response.body.stockCheck).toEqual({
        requiredQty: 50,
        availableQtyAtLocation: 80,
        shortage: 0,
      });
    });

    it('should deny access (403) to OPERATIONS role on POST /work-orders', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser1);

      const opsToken = require('jsonwebtoken').sign(
        { userId: mockOpsUser1.id, role: mockOpsUser1.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/work-orders')
        .set('Authorization', `Bearer ${opsToken}`)
        .send({
          locationId: 'loc-1',
          itemId: 'item-1',
          requiredQty: 50,
          assignedUserId: 'user-ops-1',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Insufficient permissions');
    });

    it('should deny access (403) to SALES role on POST /work-orders', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser);

      const salesToken = require('jsonwebtoken').sign(
        { userId: mockSalesUser.id, role: mockSalesUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/work-orders')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          locationId: 'loc-1',
          itemId: 'item-1',
          requiredQty: 50,
          assignedUserId: 'user-ops-1',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Insufficient permissions');
    });

    it('should reject (400) if assignedUserId points to a SALES user', async () => {
      (prisma.user.findUnique as jest.Mock).mockImplementation((args: any) => {
        if (args.where.id === 'user-admin-1') return Promise.resolve(mockAdminUser);
        if (args.where.id === 'user-sales-1') return Promise.resolve(mockSalesUser);
        return Promise.resolve(null);
      });
      (prisma.location.findUnique as jest.Mock).mockResolvedValue(mockLocation);
      (prisma.item.findUnique as jest.Mock).mockResolvedValue(mockItem);

      const adminToken = require('jsonwebtoken').sign(
        { userId: mockAdminUser.id, role: mockAdminUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .post('/work-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          locationId: 'loc-1',
          itemId: 'item-1',
          requiredQty: 50,
          assignedUserId: 'user-sales-1',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Assigned user must have role OPERATIONS');
    });

    it('should reject (400) if requiredQty is 0 or negative', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);

      const adminToken = require('jsonwebtoken').sign(
        { userId: mockAdminUser.id, role: mockAdminUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const responseZero = await request(app)
        .post('/work-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          locationId: 'loc-1',
          itemId: 'item-1',
          requiredQty: 0,
          assignedUserId: 'user-ops-1',
        });

      expect(responseZero.status).toBe(400);

      const responseNegative = await request(app)
        .post('/work-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          locationId: 'loc-1',
          itemId: 'item-1',
          requiredQty: -10,
          assignedUserId: 'user-ops-1',
        });

      expect(responseNegative.status).toBe(400);
    });
  });

  // --------------------------------------------------------------------------
  // 3. GET /work-orders & GET /work-orders/:id/stock-check Tests
  // --------------------------------------------------------------------------
  describe('GET /work-orders List, Detail & stock-check', () => {
    it('should return correct stockCheck on GET /work-orders/:id/stock-check', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser1);
      (prisma.workOrder.findUnique as jest.Mock).mockResolvedValue(mockWorkOrderAssigned);
      (prisma.inventoryStock.findMany as jest.Mock).mockResolvedValue([mockStockRecord]);

      const opsToken = require('jsonwebtoken').sign(
        { userId: mockOpsUser1.id, role: mockOpsUser1.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .get('/work-orders/wo-100/stock-check')
        .set('Authorization', `Bearer ${opsToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        requiredQty: 50,
        availableQtyAtLocation: 80,
        shortage: 0,
      });
    });

    it('should filter Work Orders by default for OPERATIONS user unless ?all=true is passed', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser1);
      (prisma.workOrder.count as jest.Mock).mockResolvedValue(1);
      (prisma.workOrder.findMany as jest.Mock).mockResolvedValue([mockWorkOrderAssigned]);
      (prisma.inventoryStock.findMany as jest.Mock).mockResolvedValue([mockStockRecord]);

      const opsToken = require('jsonwebtoken').sign(
        { userId: mockOpsUser1.id, role: mockOpsUser1.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      // Default GET for OPERATIONS (should automatically filter by assignedUserId = user.id)
      await request(app)
        .get('/work-orders')
        .set('Authorization', `Bearer ${opsToken}`);

      expect(prisma.workOrder.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedUserId: 'user-ops-1',
          }),
        })
      );

      // Explicit ?all=true GET for OPERATIONS (should NOT filter by assignedUserId)
      await request(app)
        .get('/work-orders?all=true')
        .set('Authorization', `Bearer ${opsToken}`);

      expect(prisma.workOrder.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            assignedUserId: 'user-ops-1',
          }),
        })
      );
    });
  });

  // --------------------------------------------------------------------------
  // 4. PATCH /work-orders/:id/status State Machine Tests
  // --------------------------------------------------------------------------
  describe('PATCH /work-orders/:id/status (State Machine & Assignment Guards)', () => {
    it('should allow assigned OPERATIONS user to transition ASSIGNED -> IN_PROGRESS (200)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser1);
      (prisma.workOrder.findUnique as jest.Mock).mockResolvedValue(mockWorkOrderAssigned);
      (prisma.workOrder.update as jest.Mock).mockResolvedValue(mockWorkOrderInProgress);
      (prisma.inventoryStock.findMany as jest.Mock).mockResolvedValue([mockStockRecord]);

      const opsToken = require('jsonwebtoken').sign(
        { userId: mockOpsUser1.id, role: mockOpsUser1.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/work-orders/wo-100/status')
        .set('Authorization', `Bearer ${opsToken}`)
        .send({ status: WorkOrderStatus.IN_PROGRESS });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(WorkOrderStatus.IN_PROGRESS);
    });

    it('should deny (403) a DIFFERENT OPERATIONS user from transitioning status', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockOpsUser2);
      (prisma.workOrder.findUnique as jest.Mock).mockResolvedValue(mockWorkOrderAssigned);

      const ops2Token = require('jsonwebtoken').sign(
        { userId: mockOpsUser2.id, role: mockOpsUser2.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/work-orders/wo-100/status')
        .set('Authorization', `Bearer ${ops2Token}`)
        .send({ status: WorkOrderStatus.IN_PROGRESS });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain(
        'Operations users can only update Work Orders assigned to them'
      );
    });

    it('should reject (400) direct transition ASSIGNED -> COMPLETED (skipping IN_PROGRESS)', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.workOrder.findUnique as jest.Mock).mockResolvedValue(mockWorkOrderAssigned);

      const adminToken = require('jsonwebtoken').sign(
        { userId: mockAdminUser.id, role: mockAdminUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/work-orders/wo-100/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: WorkOrderStatus.COMPLETED });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(
        'Cannot transition Work Order directly from ASSIGNED to COMPLETED'
      );
    });

    it('should reject (400) any transition on a COMPLETED Work Order', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.workOrder.findUnique as jest.Mock).mockResolvedValue(mockWorkOrderCompleted);

      const adminToken = require('jsonwebtoken').sign(
        { userId: mockAdminUser.id, role: mockAdminUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/work-orders/wo-100/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: WorkOrderStatus.IN_PROGRESS });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain(
        'Work Order is COMPLETED and cannot transition to any other status'
      );
    });

    it('should deny access (403) to SALES role on PATCH status', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockSalesUser);

      const salesToken = require('jsonwebtoken').sign(
        { userId: mockSalesUser.id, role: mockSalesUser.role },
        process.env.JWT_SECRET || 'dev-jwt-secret-min-erp-2026-key'
      );

      const response = await request(app)
        .patch('/work-orders/wo-100/status')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({ status: WorkOrderStatus.IN_PROGRESS });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toBe('Insufficient permissions');
    });
  });
});
