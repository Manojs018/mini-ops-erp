import { randomUUID } from 'crypto';
import { InventoryTransactionType, ReferenceType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, InsufficientStockError } from '../../utils/errors';

export interface ListInventoryFilters {
  locationId?: string;
  itemId?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}

export interface CreateInventoryStockInput {
  itemId: string;
  locationId: string;
  batch: string;
  physicalQty: number;
}

export interface AdjustStockInput {
  quantityChange: number;
  reason?: string;
  type?: InventoryTransactionType;
}

export interface InventoryStockResponse {
  id: string;
  itemId: string;
  locationId: string;
  batch: string;
  physicalQty: number;
  reservedQty: number;
  availableQty: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  item?: {
    id: string;
    sku: string;
    name: string;
    category?: {
      id: string;
      name: string;
    };
  };
  location?: {
    id: string;
    name: string;
  };
}

export class InventoryService {
  /**
   * Helper to format InventoryStock DB row into API response with computed availableQty.
   */
  private static formatStockResponse(stock: any): InventoryStockResponse {
    if (!stock) {
      throw new AppError('Inventory stock record not found', 404);
    }

    return {
      id: stock.id,
      itemId: stock.itemId,
      locationId: stock.locationId,
      batch: stock.batch,
      physicalQty: stock.physicalQty,
      reservedQty: stock.reservedQty,
      availableQty: stock.physicalQty - stock.reservedQty,
      version: stock.version,
      createdAt: stock.createdAt,
      updatedAt: stock.updatedAt,
      item: stock.item
        ? {
            id: stock.item.id,
            sku: stock.item.sku,
            name: stock.item.name,
            category: stock.item.category
              ? {
                  id: stock.item.category.id,
                  name: stock.item.category.name,
                }
              : undefined,
          }
        : undefined,
      location: stock.location
        ? {
            id: stock.location.id,
            name: stock.location.name,
          }
        : undefined,
    };
  }

  /**
   * List inventory stock records with joined item, category, location names and pagination.
   */
  static async listInventory(filters: ListInventoryFilters) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.locationId) {
      where.locationId = filters.locationId;
    }

    if (filters.itemId) {
      where.itemId = filters.itemId;
    }

    if (filters.categoryId) {
      where.item = {
        categoryId: filters.categoryId,
      };
    }

    const [total, records] = await Promise.all([
      prisma.inventoryStock.count({ where }),
      prisma.inventoryStock.findMany({
        where,
        skip,
        take: limit,
        include: {
          item: {
            include: {
              category: true,
            },
          },
          location: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    const data = records.map((record) => this.formatStockResponse(record));

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single inventory stock record detail by ID.
   */
  static async getInventoryById(id: string): Promise<InventoryStockResponse> {
    const record = await prisma.inventoryStock.findUnique({
      where: { id },
      include: {
        item: {
          include: {
            category: true,
          },
        },
        location: true,
      },
    });

    if (!record) {
      throw new AppError('Inventory stock record not found', 404);
    }

    return this.formatStockResponse(record);
  }

  /**
   * Create a new inventory stock record with initial RECEIPT transaction.
   */
  static async createInventoryStock(
    data: CreateInventoryStockInput
  ): Promise<InventoryStockResponse> {
    const { itemId, locationId, batch, physicalQty } = data;

    if (!itemId || typeof itemId !== 'string') {
      throw new AppError('itemId is required', 400);
    }

    if (!locationId || typeof locationId !== 'string') {
      throw new AppError('locationId is required', 400);
    }

    if (!batch || typeof batch !== 'string' || !batch.trim()) {
      throw new AppError('batch is required', 400);
    }

    if (typeof physicalQty !== 'number' || !Number.isInteger(physicalQty) || physicalQty < 0) {
      throw new AppError('Physical quantity must be a non-negative integer', 400);
    }

    // Validate itemId existence
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new AppError(`Item with ID '${itemId}' not found`, 404);
    }

    // Validate locationId existence
    const location = await prisma.location.findUnique({ where: { id: locationId } });
    if (!location) {
      throw new AppError(`Location with ID '${locationId}' not found`, 404);
    }

    // Check unique constraint (itemId, locationId, batch)
    const existingStock = await prisma.inventoryStock.findUnique({
      where: {
        itemId_locationId_batch: {
          itemId,
          locationId,
          batch: batch.trim(),
        },
      },
    });

    if (existingStock) {
      throw new AppError(
        `An inventory stock record for item '${item.name}' at location '${location.name}' with batch '${batch.trim()}' already exists. Use the PATCH /inventory/:id/adjust endpoint to update stock quantities.`,
        409
      );
    }

    // Execute stock creation and audit transaction in a single Prisma transaction
    const newStock = await prisma.$transaction(async (tx) => {
      const stock = await tx.inventoryStock.create({
        data: {
          itemId,
          locationId,
          batch: batch.trim(),
          physicalQty,
          reservedQty: 0,
        },
        include: {
          item: {
            include: {
              category: true,
            },
          },
          location: true,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryStockId: stock.id,
          type: InventoryTransactionType.RECEIPT,
          quantity: physicalQty,
          referenceType: ReferenceType.WORK_ORDER,
          referenceId: 'MANUAL_CREATION',
          idempotencyKey: randomUUID(),
        },
      });

      return stock;
    });

    return this.formatStockResponse(newStock);
  }

  /**
   * Adjust physical stock quantity and log an InventoryTransaction audit row.
   */
  static async adjustStock(
    id: string,
    data: AdjustStockInput
  ): Promise<InventoryStockResponse> {
    const { quantityChange, reason, type } = data;

    if (typeof quantityChange !== 'number' || !Number.isInteger(quantityChange)) {
      throw new AppError('quantityChange must be a non-zero integer', 400);
    }

    if (quantityChange === 0) {
      throw new AppError('quantityChange cannot be zero', 400);
    }

    const updatedStock = await prisma.$transaction(async (tx: any) => {
      const currentStock = await tx.inventoryStock.findUnique({
        where: { id },
      });

      if (!currentStock) {
        throw new AppError('Inventory stock record not found', 404);
      }

      const newPhysicalQty = currentStock.physicalQty + quantityChange;

      if (newPhysicalQty < currentStock.reservedQty) {
        throw new AppError(
          `Cannot adjust physical stock to ${newPhysicalQty}. It would fall below currently reserved quantity of ${currentStock.reservedQty}.`,
          400
        );
      }

      if (newPhysicalQty < 0) {
        throw new AppError(
          `Cannot adjust physical stock to ${newPhysicalQty}. Physical quantity cannot be negative.`,
          400
        );
      }

      let txType: InventoryTransactionType;
      if (type && Object.values(InventoryTransactionType).includes(type)) {
        txType = type;
      } else {
        txType = quantityChange > 0 ? InventoryTransactionType.RECEIPT : InventoryTransactionType.ISSUE;
      }

      const stock = await tx.inventoryStock.update({
        where: { id },
        data: {
          physicalQty: newPhysicalQty,
          version: { increment: 1 },
        },
        include: {
          item: {
            include: {
              category: true,
            },
          },
          location: true,
        },
      });

      await tx.inventoryTransaction.create({
        data: {
          inventoryStockId: stock.id,
          type: txType,
          quantity: Math.abs(quantityChange),
          referenceType: ReferenceType.WORK_ORDER,
          referenceId: reason || 'MANUAL_ADJUSTMENT',
          idempotencyKey: randomUUID(),
        },
      });

      return stock;
    });

    return this.formatStockResponse(updatedStock);
  }

  /**
   * ATOMIC CONCURRENCY ENGINE: Reserve Stock
   * Option A: Uses atomic conditional SQL UPDATE with WHERE (physical_qty - reserved_qty) >= quantity.
   * Prevents race conditions and guarantees non-negative available quantity under heavy concurrent load.
   */
  static async reserveStock(
    inventoryStockId: string,
    quantity: number,
    referenceType: ReferenceType,
    referenceId: string,
    idempotencyKey: string
  ): Promise<InventoryStockResponse> {
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError('Reservation quantity must be a positive integer', 400);
    }

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      throw new AppError('idempotencyKey is required for stock reservation', 400);
    }

    // 1. Idempotency Check: Return existing record if idempotencyKey already executed
    const existingTx = await prisma.inventoryTransaction.findUnique({
      where: { idempotencyKey },
    });

    if (existingTx) {
      return this.getInventoryById(inventoryStockId);
    }

    // 2. Atomic Conditional Update (Option A)
    // SQL: UPDATE "InventoryStock" SET "reservedQty" = "reservedQty" + $1 WHERE "id" = $2 AND ("physicalQty" - "reservedQty") >= $1
    const updatedRows = await prisma.$queryRaw<any[]>`
      UPDATE "InventoryStock"
      SET "reservedQty" = "reservedQty" + ${quantity},
          "version" = "version" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${inventoryStockId}
        AND ("physicalQty" - "reservedQty") >= ${quantity}
      RETURNING *;
    `;

    if (!updatedRows || updatedRows.length === 0) {
      const currentStock = await prisma.inventoryStock.findUnique({
        where: { id: inventoryStockId },
      });

      if (!currentStock) {
        throw new AppError('Inventory stock record not found', 404);
      }

      const available = currentStock.physicalQty - currentStock.reservedQty;
      throw new InsufficientStockError(
        `Only ${available} units available, requested ${quantity}`
      );
    }

    // 3. Log matching audit InventoryTransaction
    await prisma.inventoryTransaction.create({
      data: {
        inventoryStockId,
        type: InventoryTransactionType.RESERVE,
        quantity,
        referenceType,
        referenceId,
        idempotencyKey,
      },
    });

    return this.getInventoryById(inventoryStockId);
  }

  /**
   * ATOMIC CONCURRENCY ENGINE: Release Stock
   * Option A: Uses atomic conditional SQL UPDATE with WHERE reserved_qty >= quantity.
   * Reduces reservedQty safely and prevents negative reserved quantity.
   */
  static async releaseStock(
    inventoryStockId: string,
    quantity: number,
    referenceType: ReferenceType,
    referenceId: string,
    idempotencyKey: string
  ): Promise<InventoryStockResponse> {
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      throw new AppError('Release quantity must be a positive integer', 400);
    }

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      throw new AppError('idempotencyKey is required for stock release', 400);
    }

    // 1. Idempotency Check: Return existing record if idempotencyKey already executed
    const existingTx = await prisma.inventoryTransaction.findUnique({
      where: { idempotencyKey },
    });

    if (existingTx) {
      return this.getInventoryById(inventoryStockId);
    }

    // 2. Atomic Conditional Update (Option A)
    const updatedRows = await prisma.$queryRaw<any[]>`
      UPDATE "InventoryStock"
      SET "reservedQty" = "reservedQty" - ${quantity},
          "version" = "version" + 1,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${inventoryStockId}
        AND "reservedQty" >= ${quantity}
      RETURNING *;
    `;

    if (!updatedRows || updatedRows.length === 0) {
      const currentStock = await prisma.inventoryStock.findUnique({
        where: { id: inventoryStockId },
      });

      if (!currentStock) {
        throw new AppError('Inventory stock record not found', 404);
      }

      throw new AppError(
        `Cannot release ${quantity} units as only ${currentStock.reservedQty} units are currently reserved`,
        400
      );
    }

    // 3. Log matching audit InventoryTransaction
    await prisma.inventoryTransaction.create({
      data: {
        inventoryStockId,
        type: InventoryTransactionType.RELEASE,
        quantity,
        referenceType,
        referenceId,
        idempotencyKey,
      },
    });

    return this.getInventoryById(inventoryStockId);
  }
}
