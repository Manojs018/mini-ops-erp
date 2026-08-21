import { StockTransferStatus, InventoryTransactionType, ReferenceType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, InsufficientStockError, InvalidTransferStateError } from '../../utils/errors';

export interface CreateTransferInput {
  sourceLocationId: string;
  destinationLocationId: string;
  itemId: string;
  quantity: number;
}

export interface ListTransferFilters {
  status?: StockTransferStatus;
  sourceLocationId?: string;
  destinationLocationId?: string;
  itemId?: string;
  page?: number;
  limit?: number;
}

export class TransferService {
  /**
   * Request a new stock transfer.
   * Does NOT check or touch inventory stock; simply records intent.
   */
  static async requestTransfer(data: CreateTransferInput) {
    const { sourceLocationId, destinationLocationId, itemId, quantity } = data;

    if (
      typeof quantity !== 'number' ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      throw new AppError('quantity must be a positive integer', 400);
    }

    if (!sourceLocationId || typeof sourceLocationId !== 'string') {
      throw new AppError('sourceLocationId is required', 400);
    }

    if (!destinationLocationId || typeof destinationLocationId !== 'string') {
      throw new AppError('destinationLocationId is required', 400);
    }

    if (sourceLocationId === destinationLocationId) {
      throw new AppError('Source and destination locations cannot be the same', 400);
    }

    if (!itemId || typeof itemId !== 'string') {
      throw new AppError('itemId is required', 400);
    }

    // Validate sourceLocation existence
    const sourceLocation = await prisma.location.findUnique({
      where: { id: sourceLocationId },
    });
    if (!sourceLocation) {
      throw new AppError(`Source location with ID '${sourceLocationId}' not found`, 404);
    }

    // Validate destinationLocation existence
    const destinationLocation = await prisma.location.findUnique({
      where: { id: destinationLocationId },
    });
    if (!destinationLocation) {
      throw new AppError(`Destination location with ID '${destinationLocationId}' not found`, 404);
    }

    // Validate item existence
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new AppError(`Item with ID '${itemId}' not found`, 404);
    }

    const transfer = await prisma.stockTransfer.create({
      data: {
        sourceLocationId,
        destinationLocationId,
        itemId,
        quantity,
        status: StockTransferStatus.REQUESTED,
      },
      include: {
        sourceLocation: true,
        destinationLocation: true,
        item: {
          include: {
            category: true,
          },
        },
      },
    });

    return transfer;
  }

  /**
   * List Stock Transfers with optional filters and pagination.
   */
  static async listTransfers(filters: ListTransferFilters) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.sourceLocationId) {
      where.sourceLocationId = filters.sourceLocationId;
    }

    if (filters.destinationLocationId) {
      where.destinationLocationId = filters.destinationLocationId;
    }

    if (filters.itemId) {
      where.itemId = filters.itemId;
    }

    const [total, records] = await Promise.all([
      prisma.stockTransfer.count({ where }),
      prisma.stockTransfer.findMany({
        where,
        skip,
        take: limit,
        include: {
          sourceLocation: true,
          destinationLocation: true,
          item: {
            include: {
              category: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return {
      data: records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single Stock Transfer detail by ID.
   */
  static async getTransferById(id: string) {
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        sourceLocation: true,
        destinationLocation: true,
        item: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!transfer) {
      throw new AppError('Stock Transfer not found', 404);
    }

    return transfer;
  }

  /**
   * ATOMIC DISPATCH STEP: dispatchTransfer
   * - Verifies current status is REQUESTED.
   * - Deducts physical stock from source location using FIFO batch allocation (createdAt asc).
   * - Throws InsufficientStockError (409 Conflict) if total physical stock at source < quantity.
   * - Updates status to DISPATCHED and sets dispatchedAt timestamp.
   * - Logs InventoryTransaction of type TRANSFER_OUT.
   * - Destination stock is NOT touched at this step.
   */
  static async dispatchTransfer(transferId: string, idempotencyKey?: string) {
    const existingTransfer = await prisma.stockTransfer.findUnique({
      where: { id: transferId },
    });

    if (!existingTransfer) {
      throw new AppError('Stock Transfer not found', 404);
    }

    if (existingTransfer.status !== StockTransferStatus.REQUESTED) {
      throw new InvalidTransferStateError(
        `Transfer cannot be dispatched. Current status is ${existingTransfer.status}. Only REQUESTED transfers can be dispatched.`
      );
    }

    const dispatchKey = idempotencyKey || `transfer-dispatch-${transferId}`;

    const updatedTransfer = await prisma.$transaction(async (tx) => {
      // 1. Fetch source inventory stock rows ordered FIFO by createdAt
      const sourceStocks = await tx.inventoryStock.findMany({
        where: {
          itemId: existingTransfer.itemId,
          locationId: existingTransfer.sourceLocationId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      const totalPhysicalAvailable = sourceStocks.reduce(
        (sum, row) => sum + row.physicalQty,
        0
      );

      if (totalPhysicalAvailable < existingTransfer.quantity) {
        throw new InsufficientStockError(
          `Only ${totalPhysicalAvailable} units available at source, requested ${existingTransfer.quantity}`
        );
      }

      // 2. Deduct physical stock across source batches in FIFO order
      let remainingToDeduct = existingTransfer.quantity;
      for (const stockRow of sourceStocks) {
        if (remainingToDeduct <= 0) break;

        const deductQty = Math.min(stockRow.physicalQty, remainingToDeduct);
        if (deductQty > 0) {
          await tx.inventoryStock.update({
            where: { id: stockRow.id },
            data: {
              physicalQty: stockRow.physicalQty - deductQty,
              version: { increment: 1 },
            },
          });
          remainingToDeduct -= deductQty;
        }
      }

      // 3. Update Transfer status to DISPATCHED
      const transfer = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: StockTransferStatus.DISPATCHED,
          dispatchedAt: new Date(),
        },
        include: {
          sourceLocation: true,
          destinationLocation: true,
          item: {
            include: {
              category: true,
            },
          },
        },
      });

      // 4. Log TRANSFER_OUT audit InventoryTransaction
      // First source stock row's ID is used as foreign key container
      const primarySourceStockId = sourceStocks[0].id;
      await tx.inventoryTransaction.create({
        data: {
          inventoryStockId: primarySourceStockId,
          type: InventoryTransactionType.TRANSFER_OUT,
          quantity: existingTransfer.quantity,
          referenceType: ReferenceType.TRANSFER,
          referenceId: transferId,
          idempotencyKey: dispatchKey,
        },
      });

      return transfer;
    });

    return updatedTransfer;
  }

  /**
   * ATOMIC RECEIVE STEP: receiveTransfer
   * - Re-checks transfer status inside transaction to serialize concurrent requests.
   * - Rejects if status is REQUESTED (not dispatched yet) with 400.
   * - Rejects if status is RECEIVED with 409 Conflict ("Transfer has already been received").
   * - Preserves batch traceability by finding or creating destination InventoryStock row.
   * - Increments destination physicalQty by transfer quantity.
   * - Updates status to RECEIVED and sets receivedAt timestamp.
   * - Logs InventoryTransaction of type TRANSFER_IN.
   */
  static async receiveTransfer(transferId: string, idempotencyKey?: string) {
    const rxIdempotencyKey = idempotencyKey || `transfer-receive-${transferId}`;

    return await prisma.$transaction(async (tx) => {
      // 1. Re-query transfer status inside the database transaction for concurrency safety
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: transferId },
        include: {
          sourceLocation: true,
          destinationLocation: true,
          item: {
            include: {
              category: true,
            },
          },
        },
      });

      if (!transfer) {
        throw new AppError('Stock Transfer not found', 404);
      }

      // Guard: Cannot receive already-received transfer (409 Conflict)
      if (transfer.status === StockTransferStatus.RECEIVED) {
        throw new AppError('Transfer has already been received.', 409);
      }

      // Guard: Cannot receive non-dispatched transfer (400 Bad Request)
      if (transfer.status !== StockTransferStatus.DISPATCHED) {
        throw new InvalidTransferStateError(
          `Transfer cannot be received. Current status is ${transfer.status}. Only DISPATCHED transfers can be received.`
        );
      }

      // 2. Idempotency Check: Return existing record if transaction was already processed
      const existingTx = await tx.inventoryTransaction.findUnique({
        where: { idempotencyKey: rxIdempotencyKey },
      });

      if (existingTx) {
        return transfer;
      }

      // 3. Preserve batch identifier from source stock
      const sourceStock = await tx.inventoryStock.findFirst({
        where: {
          itemId: transfer.itemId,
          locationId: transfer.sourceLocationId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      const batchToPreserve = sourceStock ? sourceStock.batch : 'BATCH-TRANSFER-GENERIC';

      // 4. Find or create destination InventoryStock record for (itemId, destinationLocationId, batch)
      const existingDestStock = await tx.inventoryStock.findUnique({
        where: {
          itemId_locationId_batch: {
            itemId: transfer.itemId,
            locationId: transfer.destinationLocationId,
            batch: batchToPreserve,
          },
        },
      });

      let destinationStockId: string;

      if (existingDestStock) {
        const updatedDestStock = await tx.inventoryStock.update({
          where: { id: existingDestStock.id },
          data: {
            physicalQty: existingDestStock.physicalQty + transfer.quantity,
            version: { increment: 1 },
          },
        });
        destinationStockId = updatedDestStock.id;
      } else {
        const newDestStock = await tx.inventoryStock.create({
          data: {
            itemId: transfer.itemId,
            locationId: transfer.destinationLocationId,
            batch: batchToPreserve,
            physicalQty: transfer.quantity,
            reservedQty: 0,
          },
        });
        destinationStockId = newDestStock.id;
      }

      // 5. Update Transfer status to RECEIVED
      const updatedTransfer = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: StockTransferStatus.RECEIVED,
          receivedAt: new Date(),
        },
        include: {
          sourceLocation: true,
          destinationLocation: true,
          item: {
            include: {
              category: true,
            },
          },
        },
      });

      // 6. Log TRANSFER_IN audit InventoryTransaction
      await tx.inventoryTransaction.create({
        data: {
          inventoryStockId: destinationStockId,
          type: InventoryTransactionType.TRANSFER_IN,
          quantity: transfer.quantity,
          referenceType: ReferenceType.TRANSFER,
          referenceId: transferId,
          idempotencyKey: rxIdempotencyKey,
        },
      });

      return updatedTransfer;
    });
  }
}
