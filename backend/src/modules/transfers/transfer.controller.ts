import { Request, Response, NextFunction } from 'express';
import { TransferService } from './transfer.service';
import { StockTransferStatus } from '@prisma/client';

export class TransferController {
  /**
   * POST /transfers
   * Request a new stock transfer (ADMIN, OPERATIONS)
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sourceLocationId, destinationLocationId, itemId, quantity } = req.body;

      const result = await TransferService.requestTransfer({
        sourceLocationId,
        destinationLocationId,
        itemId,
        quantity,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /transfers
   * List transfers with optional filters and pagination
   */
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, sourceLocationId, destinationLocationId, itemId, page, limit } = req.query;

      const result = await TransferService.listTransfers({
        status: status as StockTransferStatus,
        sourceLocationId: sourceLocationId as string,
        destinationLocationId: destinationLocationId as string,
        itemId: itemId as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /transfers/:id
   * Single transfer detail
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await TransferService.getTransferById(id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /transfers/:id/dispatch
   * Atomic dispatch: deducts source stock and sets status to DISPATCHED
   */
  static async dispatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const idempotencyKey = req.headers['x-idempotency-key'] as string;

      const result = await TransferService.dispatchTransfer(id, idempotencyKey);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /transfers/:id/receive
   * Atomic receive: increments destination stock and sets status to RECEIVED
   */
  static async receive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const idempotencyKey = req.headers['x-idempotency-key'] as string;

      const result = await TransferService.receiveTransfer(id, idempotencyKey);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
