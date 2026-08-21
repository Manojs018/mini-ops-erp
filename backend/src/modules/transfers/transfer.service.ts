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
   * Helper to format StockTransfer DB row into response object with computed remainingQty.
   */
  private static formatTransferResponse(transfer: any) {
    if (!transfer) return transfer;
    const receivedQty = transfer.receivedQty || 0;
    return {
      ...transfer,
      receivedQty,
      remainingQty: Math.max(0, transfer.quantity - receivedQty),
    };
  }

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
        receivedQty: 0,
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

    return this.formatTransferResponse(transfer);
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
      data: records.map((record: any) => this.formatTransferResponse(record)),
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

    return this.formatTransferResponse(transfer);
  }

  /**
   * ATOMIC DISPATCH STEP: dispatchTransfer
   */
  static async dispatchTransfer(transferId: string, idempotencyKey?: string) {
    const dispatchKey = idempotencyKey || `transfer-dispatch-${transferId}`;

    return await prisma.$transaction(async (tx: any) => {
      const existingTransfer = await tx.stockTransfer.findUnique({
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
        (sum: number, row: any) => sum + row.physicalQty,
        0
      );

      if (totalPhysicalAvailable < existingTransfer.quantity) {
        throw new InsufficientStockError(
          `Only ${totalPhysicalAvailable} units available at source, requested ${existingTransfer.quantity}`
        );
      }

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

      const primarySourceStockId = sourceStocks.length > 0 ? sourceStocks[0].id : existingTransfer.itemId;
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

      return this.formatTransferResponse(transfer);
    });
  }

  /**
   * ATOMIC RECEIVE STEP: receiveTransfer
   * Supports full receipt (quantity === undefined) or partial receipt (explicit quantity).
   */
  static async receiveTransfer(transferId: string, idempotencyKey?: string, quantity?: number) {
    return await prisma.$transaction(async (tx: any) => {
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

      // Guard: Cannot receive non-dispatched & non-partially-received transfer (400 Bad Request)
      if (
        transfer.status !== StockTransferStatus.DISPATCHED &&
        transfer.status !== StockTransferStatus.PARTIALLY_RECEIVED
      ) {
        throw new InvalidTransferStateError(
          `Transfer cannot be received. Current status is ${transfer.status}. Only DISPATCHED or PARTIALLY_RECEIVED transfers can be received.`
        );
      }

      const currentReceivedQty = transfer.receivedQty || 0;
      const remainingUnreceived = transfer.quantity - currentReceivedQty;

      // Determine actual receive quantity for this invocation
      let receiveQty: number;
      if (quantity === undefined || quantity === null) {
        receiveQty = remainingUnreceived; // Full remaining receipt
      } else {
        if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
          throw new AppError('Received quantity must be a positive integer', 400);
        }

        if (quantity > remainingUnreceived) {
          throw new AppError(
            `Only ${remainingUnreceived} units remain to be received on this transfer`,
            400
          );
        }
        receiveQty = quantity;
      }

      const newReceivedQty = currentReceivedQty + receiveQty;
      const isFullyReceived = newReceivedQty === transfer.quantity;
      const newStatus = isFullyReceived ? StockTransferStatus.RECEIVED : StockTransferStatus.PARTIALLY_RECEIVED;

      const rxIdempotencyKey = idempotencyKey || `transfer-receive-${transferId}-${newReceivedQty}`;

      // 2. Idempotency Check: Return existing record if transaction was already processed
      const existingTx = await tx.inventoryTransaction.findUnique({
        where: { idempotencyKey: rxIdempotencyKey },
      });

      if (existingTx) {
        return this.formatTransferResponse(transfer);
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
            physicalQty: existingDestStock.physicalQty + receiveQty,
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
            physicalQty: receiveQty,
            reservedQty: 0,
          },
        });
        destinationStockId = newDestStock.id;
      }

      // 5. Update Transfer status and receivedQty
      const updatedTransfer = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          receivedQty: newReceivedQty,
          status: newStatus,
          receivedAt: isFullyReceived ? new Date() : transfer.receivedAt,
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
          quantity: receiveQty,
          referenceType: ReferenceType.TRANSFER,
          referenceId: transferId,
          idempotencyKey: rxIdempotencyKey,
        },
      });

      return this.formatTransferResponse(updatedTransfer);
    });
  }
}
