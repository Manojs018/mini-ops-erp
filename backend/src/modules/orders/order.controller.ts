import { Request, Response, NextFunction } from 'express';
import { OrderService } from './order.service';
import { CustomerOrderStatus, Role } from '@prisma/client';

export class OrderController {
  /**
   * POST /orders
   * Create a new Customer Order (SALES role only)
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { customerName, lines } = req.body;
      const salesUserId = req.user!.userId;

      const result = await OrderService.createOrder({
        customerName,
        lines,
        salesUserId,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /orders
   * List orders with filtering and pagination (ADMIN, OPERATIONS, SALES)
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, salesUserId, page, limit, all } = req.query;
      const currentUser = req.user!;

      const result = await OrderService.listOrders({
        status: status as CustomerOrderStatus,
        salesUserId: salesUserId as string,
        isSalesRole: currentUser.role === Role.SALES,
        currentUserId: currentUser.userId,
        allowAllForSales: all === 'true',
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /orders/:id
   * Get single order detail (ADMIN, OPERATIONS, SALES)
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = req.user!;

      const result = await OrderService.getOrderById(
        id,
        currentUser.role === Role.SALES,
        currentUser.userId
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /orders/:id/cancel
   * Cancel an order and release reserved stock (SALES own orders, ADMIN any order)
   */
  static async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = req.user!;

      const result = await OrderService.cancelOrder(
        id,
        currentUser.userId,
        currentUser.role
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
