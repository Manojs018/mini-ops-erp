import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service';

export class InventoryController {
  /**
   * GET /inventory
   * List inventory with filters and pagination
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { locationId, itemId, categoryId, page, limit } = req.query;

      const result = await InventoryService.listInventory({
        locationId: locationId as string,
        itemId: itemId as string,
        categoryId: categoryId as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /inventory/:id
   * Get single inventory stock detail
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await InventoryService.getInventoryById(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /inventory
   * Create new inventory stock record (ADMIN, OPERATIONS)
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { itemId, locationId, batch, physicalQty } = req.body;

      const result = await InventoryService.createInventoryStock({
        itemId,
        locationId,
        batch,
        physicalQty,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /inventory/:id/adjust
   * Adjust physical stock quantity (ADMIN, OPERATIONS)
   */
  static async adjust(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { quantityChange, reason, type } = req.body;

      const result = await InventoryService.adjustStock(id, {
        quantityChange,
        reason,
        type,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /inventory/:id/report-damage
   * Report damaged stock (ADMIN, OPERATIONS)
   */
  static async reportDamage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { quantity, reason } = req.body;

      const result = await InventoryService.reportDamage(id, { quantity, reason });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
