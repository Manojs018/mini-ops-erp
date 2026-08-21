import { CustomerOrderStatus, ReferenceType, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, InsufficientStockError, OrderAlreadyCancelledError } from '../../utils/errors';
import { InventoryService } from '../inventory/inventory.service';

export interface CreateOrderLineInput {
  inventoryStockId: string;
  quantity: number;
}

export interface CreateOrderInput {
  customerName: string;
  lines: CreateOrderLineInput[];
  salesUserId: string;
}

export interface ListOrderFilters {
  status?: CustomerOrderStatus;
  salesUserId?: string;
  isSalesRole?: boolean;
  currentUserId?: string;
  allowAllForSales?: boolean;
  page?: number;
  limit?: number;
}

export class OrderService {
  /**
   * Create a new Customer Order with one or more lines.
   * - Role restriction: SALES role only.
   * - Atomic All-or-Nothing reservation: Executed inside a single database transaction.
   * - SCOPE DECISION: Per schema design, CustomerOrderLine references a specific inventoryStockId
   *   (batch & location pair chosen by client), not auto-allocated across multiple batches.
   *   Client must submit separate lines if reserving across multiple batches.
   */
  static async createOrder(data: CreateOrderInput) {
    const { customerName, lines, salesUserId } = data;

    if (!customerName || typeof customerName !== 'string' || customerName.trim() === '') {
      throw new AppError('customerName must be a non-empty string', 400);
    }

    if (!Array.isArray(lines) || lines.length === 0) {
      throw new AppError('lines must be a non-empty array of order items', 400);
    }

    if (!salesUserId || typeof salesUserId !== 'string') {
      throw new AppError('salesUserId is required', 400);
    }

    // Verify salesUser existence
    const salesUser = await prisma.user.findUnique({
      where: { id: salesUserId },
    });
    if (!salesUser) {
      throw new AppError(`Sales user with ID '${salesUserId}' not found`, 404);
    }

    // Line Validation & Duplicate inventoryStockId Check
    const seenStockIds = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (
        typeof line.quantity !== 'number' ||
        !Number.isInteger(line.quantity) ||
        line.quantity <= 0
      ) {
        throw new AppError(`Line ${i + 1}: quantity must be a positive integer`, 400);
      }

      if (!line.inventoryStockId || typeof line.inventoryStockId !== 'string') {
        throw new AppError(`Line ${i + 1}: inventoryStockId is required`, 400);
      }

      if (seenStockIds.has(line.inventoryStockId)) {
        throw new AppError(
          `Duplicate inventoryStockId '${line.inventoryStockId}' found in order lines. Combine quantities into a single line instead of splitting across multiple lines.`,
          400
        );
      }
      seenStockIds.add(line.inventoryStockId);
    }

    // Check existence of all inventoryStock records before starting transaction
    const stockRecordsMap = new Map<string, any>();
    for (const line of lines) {
      const stock = await prisma.inventoryStock.findUnique({
        where: { id: line.inventoryStockId },
        include: { item: true, location: true },
      });

      if (!stock) {
        throw new AppError(
          `Inventory stock record with ID '${line.inventoryStockId}' not found`,
          404
        );
      }
      stockRecordsMap.set(line.inventoryStockId, stock);
    }

    // ATOMIC ALL-OR-NOTHING RESERVATION TRANSACTION
    return await prisma.$transaction(async (tx) => {
      // 1. Insert CustomerOrder parent row inside transaction
      const order = await tx.customerOrder.create({
        data: {
          customerName: customerName.trim(),
          salesUserId,
          status: CustomerOrderStatus.RESERVED,
        },
      });

      // 2. Reserve stock for EACH line inside the SAME transaction
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const stock = stockRecordsMap.get(line.inventoryStockId)!;
        const lineIdempotencyKey = `order-${order.id}-line-${index}`;

        // Calling InventoryService.reserveStock with tx context
        await InventoryService.reserveStock(
          line.inventoryStockId,
          line.quantity,
          ReferenceType.ORDER,
          order.id,
          lineIdempotencyKey,
          tx
        );

        // 3. Create CustomerOrderLine row inside transaction
        await tx.customerOrderLine.create({
          data: {
            customerOrderId: order.id,
            itemId: stock.itemId,
            locationId: stock.locationId,
            inventoryStockId: line.inventoryStockId,
            quantity: line.quantity,
          },
        });
      }

      // Return created order with full joins
      return await tx.customerOrder.findUnique({
        where: { id: order.id },
        include: {
          salesUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          lines: {
            include: {
              item: true,
              location: true,
              inventoryStock: true,
            },
          },
        },
      });
    });
  }

  /**
   * List Customer Orders with filtering, pagination, and SALES role scoping.
   */
  static async listOrders(filters: ListOrderFilters) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    // Role-based visibility rule:
    // SALES users see their own orders by default unless ?all=true is explicitly passed.
    if (filters.isSalesRole && !filters.allowAllForSales) {
      where.salesUserId = filters.currentUserId;
    } else if (filters.salesUserId) {
      where.salesUserId = filters.salesUserId;
    }

    const [total, records] = await Promise.all([
      prisma.customerOrder.count({ where }),
      prisma.customerOrder.findMany({
        where,
        skip,
        take: limit,
        include: {
          salesUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          lines: {
            include: {
              item: true,
              location: true,
              inventoryStock: true,
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
   * Get single Customer Order detail by ID.
   */
  static async getOrderById(id: string, isSalesRole?: boolean, currentUserId?: string) {
    const order = await prisma.customerOrder.findUnique({
      where: { id },
      include: {
        salesUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        lines: {
          include: {
            item: true,
            location: true,
            inventoryStock: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError('Customer Order not found', 404);
    }

    // Role-based visibility guard for SALES users
    if (isSalesRole && order.salesUserId !== currentUserId) {
      throw new AppError('Insufficient permissions to view this order', 403);
    }

    return order;
  }

  /**
   * ATOMIC ORDER CANCELLATION: cancelOrder
   * - Status guard: Only RESERVED orders can be cancelled.
   * - Role guard: SALES users can only cancel their own orders; ADMIN can cancel any order.
   * - Atomic Stock Release: Executes inside a database transaction, releasing reservedQty per line.
   * - Race Condition Guard: Re-queries status inside transaction to serialize concurrent cancellations.
   */
  static async cancelOrder(orderId: string, currentUserId: string, currentUserRole: Role) {
    return await prisma.$transaction(async (tx) => {
      // 1. Re-query order status inside transaction (row lock & concurrency guard)
      const order = await tx.customerOrder.findUnique({
        where: { id: orderId },
        include: {
          lines: true,
        },
      });

      if (!order) {
        throw new AppError('Customer Order not found', 404);
      }

      // Role authorization check: SALES users can only cancel their own orders
      if (currentUserRole === Role.SALES && order.salesUserId !== currentUserId) {
        throw new AppError('Insufficient permissions. Sales reps can only cancel their own orders.', 403);
      }

      // Status guard: Reject if already CANCELLED with 409 Conflict
      if (order.status === CustomerOrderStatus.CANCELLED) {
        throw new OrderAlreadyCancelledError('Customer order has already been cancelled.');
      }

      // 2. Release reservedQty for EACH line on the order
      for (let index = 0; index < order.lines.length; index++) {
        const line = order.lines[index];
        const cancelIdempotencyKey = `order-${order.id}-line-${index}-cancel`;

        await InventoryService.releaseStock(
          line.inventoryStockId,
          line.quantity,
          ReferenceType.ORDER,
          order.id,
          cancelIdempotencyKey,
          tx
        );
      }

      // 3. Update CustomerOrder status to CANCELLED
      const updatedOrder = await tx.customerOrder.update({
        where: { id: orderId },
        data: {
          status: CustomerOrderStatus.CANCELLED,
        },
        include: {
          salesUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          lines: {
            include: {
              item: true,
              location: true,
              inventoryStock: true,
            },
          },
        },
      });

      return updatedOrder;
    });
  }
}
