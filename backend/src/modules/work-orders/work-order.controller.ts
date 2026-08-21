import { Request, Response, NextFunction } from 'express';
import { WorkOrderService } from './work-order.service';
import { WorkOrderStatus } from '@prisma/client';

export class WorkOrderController {
  /**
   * POST /work-orders
   * Create a new Work Order (ADMIN only)
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { locationId, itemId, requiredQty, assignedUserId } = req.body;

      const result = await WorkOrderService.createWorkOrder({
        locationId,
        itemId,
        requiredQty,
        assignedUserId,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /work-orders
   * List Work Orders with filters and pagination
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, locationId, assignedUserId, all, page, limit } = req.query;

      const result = await WorkOrderService.listWorkOrders(
        {
          status: status as WorkOrderStatus,
          locationId: locationId as string,
          assignedUserId: assignedUserId as string,
          all: all === 'true',
          page: page ? Number(page) : undefined,
          limit: limit ? Number(limit) : undefined,
        },
        req.user!
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /work-orders/:id
   * Single Work Order detail with live stockCheck
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await WorkOrderService.getWorkOrderById(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /work-orders/:id/stock-check
   * Standalone stock-check object
   */
  static async getStockCheck(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const result = await WorkOrderService.getWorkOrderStockCheck(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /work-orders/:id/status
   * Update Work Order status with state machine guards
   */
  static async updateStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const result = await WorkOrderService.updateWorkOrderStatus(
        id,
        status as WorkOrderStatus,
        req.user!
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
