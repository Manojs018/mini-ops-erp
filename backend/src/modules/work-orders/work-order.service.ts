import { WorkOrderStatus, Role } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError, InvalidTransitionError } from '../../utils/errors';

export interface StockCheckResult {
  requiredQty: number;
  availableQtyAtLocation: number;
  shortage: number;
}

export interface CreateWorkOrderInput {
  locationId: string;
  itemId: string;
  requiredQty: number;
  assignedUserId: string;
}

export interface ListWorkOrderFilters {
  status?: WorkOrderStatus;
  locationId?: string;
  assignedUserId?: string;
  all?: boolean;
  page?: number;
  limit?: number;
}

export interface CurrentUserInfo {
  userId: string;
  role: Role;
}

export class WorkOrderService {
  /**
   * Pure, testable shortage calculation function.
   * shortage = max(0, requiredQty - availableQty)
   */
  static calculateShortage(requiredQty: number, availableQty: number): number {
    return Math.max(0, requiredQty - availableQty);
  }

  /**
   * Computes live stock availability for an item at a specific location
   * by summing (physicalQty - reservedQty) across all batch records.
   */
  static async computeStockCheck(
    itemId: string,
    locationId: string,
    requiredQty: number
  ): Promise<StockCheckResult> {
    const stockRecords = await prisma.inventoryStock.findMany({
      where: {
        itemId,
        locationId,
      },
    });

    const availableQtyAtLocation = stockRecords.reduce(
      (sum: number, record: any) => sum + (record.physicalQty - record.reservedQty),
      0
    );

    const shortage = this.calculateShortage(requiredQty, availableQtyAtLocation);

    return {
      requiredQty,
      availableQtyAtLocation,
      shortage,
    };
  }

  /**
   * Create a new Work Order (ADMIN only).
   */
  static async createWorkOrder(data: CreateWorkOrderInput) {
    const { locationId, itemId, requiredQty, assignedUserId } = data;

    if (
      typeof requiredQty !== 'number' ||
      !Number.isInteger(requiredQty) ||
      requiredQty <= 0
    ) {
      throw new AppError('requiredQty must be a positive integer', 400);
    }

    if (!locationId || typeof locationId !== 'string') {
      throw new AppError('locationId is required', 400);
    }

    if (!itemId || typeof itemId !== 'string') {
      throw new AppError('itemId is required', 400);
    }

    if (!assignedUserId || typeof assignedUserId !== 'string') {
      throw new AppError('assignedUserId is required', 400);
    }

    // Validate location existence
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });
    if (!location) {
      throw new AppError(`Location with ID '${locationId}' not found`, 404);
    }

    // Validate item existence
    const item = await prisma.item.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new AppError(`Item with ID '${itemId}' not found`, 404);
    }

    // Validate assigned user existence
    const assignedUser = await prisma.user.findUnique({
      where: { id: assignedUserId },
    });
    if (!assignedUser) {
      throw new AppError(`Assigned user with ID '${assignedUserId}' not found`, 404);
    }

    // Validate assigned user role is OPERATIONS
    if (assignedUser.role !== Role.OPERATIONS) {
      throw new AppError(
        `Assigned user must have role OPERATIONS. User '${assignedUser.name}' has role '${assignedUser.role}'.`,
        400
      );
    }

    // Create Work Order always starting in ASSIGNED status
    const workOrder = await prisma.workOrder.create({
      data: {
        locationId,
        itemId,
        requiredQty,
        assignedUserId,
        status: WorkOrderStatus.ASSIGNED,
      },
      include: {
        location: true,
        item: {
          include: {
            category: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const stockCheck = await this.computeStockCheck(itemId, locationId, requiredQty);

    return {
      ...workOrder,
      stockCheck,
    };
  }

  /**
   * List Work Orders with filters, pagination, and OPERATIONS user scoping.
   */
  static async listWorkOrders(
    filters: ListWorkOrderFilters,
    currentUser: CurrentUserInfo
  ) {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.locationId) {
      where.locationId = filters.locationId;
    }

    // OPERATIONS scoping: Default to assigned Work Orders unless explicit assignedUserId or all=true is passed
    if (currentUser.role === Role.OPERATIONS) {
      if (filters.assignedUserId) {
        where.assignedUserId = filters.assignedUserId;
      } else if (!filters.all) {
        where.assignedUserId = currentUser.userId;
      }
    } else if (filters.assignedUserId) {
      where.assignedUserId = filters.assignedUserId;
    }

    const [total, records] = await Promise.all([
      prisma.workOrder.count({ where }),
      prisma.workOrder.findMany({
        where,
        skip,
        take: limit,
        include: {
          location: true,
          item: {
            include: {
              category: true,
            },
          },
          assignedUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    // Attach computed stockCheck for convenience on listed work orders
    const dataWithStockCheck = await Promise.all(
      records.map(async (record: any) => {
        const stockCheck = await this.computeStockCheck(
          record.itemId,
          record.locationId,
          record.requiredQty
        );
        return {
          ...record,
          stockCheck,
        };
      })
    );

    return {
      data: dataWithStockCheck,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single Work Order detail with embedded live stockCheck object.
   */
  static async getWorkOrderById(id: string) {
    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        location: true,
        item: {
          include: {
            category: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!workOrder) {
      throw new AppError('Work Order not found', 404);
    }

    const stockCheck = await this.computeStockCheck(
      workOrder.itemId,
      workOrder.locationId,
      workOrder.requiredQty
    );

    return {
      ...workOrder,
      stockCheck,
    };
  }

  /**
   * Standalone stock-check endpoint for a Work Order.
   */
  static async getWorkOrderStockCheck(id: string): Promise<StockCheckResult> {
    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
    });

    if (!workOrder) {
      throw new AppError('Work Order not found', 404);
    }

    return this.computeStockCheck(
      workOrder.itemId,
      workOrder.locationId,
      workOrder.requiredQty
    );
  }

  /**
   * Update Work Order status enforcing strict state machine transitions and role rules.
   */
  static async updateWorkOrderStatus(
    id: string,
    targetStatus: WorkOrderStatus,
    currentUser: CurrentUserInfo
  ) {
    if (!targetStatus || !Object.values(WorkOrderStatus).includes(targetStatus)) {
      throw new AppError(
        `Invalid status. Status must be one of: ${Object.values(WorkOrderStatus).join(', ')}`,
        400
      );
    }

    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
    });

    if (!workOrder) {
      throw new AppError('Work Order not found', 404);
    }

    // Role Rule: OPERATIONS users can only transition Work Orders assigned to them
    if (
      currentUser.role === Role.OPERATIONS &&
      workOrder.assignedUserId !== currentUser.userId
    ) {
      throw new AppError(
        'Insufficient permissions: Operations users can only update Work Orders assigned to them',
        403
      );
    }

    const currentStatus = workOrder.status;

    // Enforce Strict State Machine Transitions:
    // ASSIGNED -> IN_PROGRESS (allowed)
    // IN_PROGRESS -> COMPLETED (allowed)
    // ASSIGNED -> COMPLETED (NOT allowed, must pass through IN_PROGRESS)
    // any -> ASSIGNED (NOT allowed)
    // COMPLETED -> anything (NOT allowed, terminal state)

    if (currentStatus === WorkOrderStatus.COMPLETED) {
      throw new InvalidTransitionError(
        'Work Order is COMPLETED and cannot transition to any other status.'
      );
    }

    if (targetStatus === WorkOrderStatus.ASSIGNED) {
      throw new InvalidTransitionError(
        `Cannot transition Work Order backward to ASSIGNED from '${currentStatus}'.`
      );
    }

    if (currentStatus === WorkOrderStatus.ASSIGNED) {
      if (targetStatus === WorkOrderStatus.COMPLETED) {
        throw new InvalidTransitionError(
          'Cannot transition Work Order directly from ASSIGNED to COMPLETED. Work Order must pass through IN_PROGRESS first.'
        );
      }
      if (targetStatus !== WorkOrderStatus.IN_PROGRESS) {
        throw new InvalidTransitionError(
          `Invalid transition from ASSIGNED to '${targetStatus}'.`
        );
      }
    } else if (currentStatus === WorkOrderStatus.IN_PROGRESS) {
      if (targetStatus !== WorkOrderStatus.COMPLETED) {
        throw new InvalidTransitionError(
          `Invalid transition from IN_PROGRESS to '${targetStatus}'.`
        );
      }
    }

    // NOTE: When transitioning to COMPLETED, we intentionally do NOT re-check or block on stock shortage.
    // Completion of a Work Order is a manual/physical operational confirmation by the Operations user,
    // not something the ERP system should gate or block.

    const updatedWorkOrder = await prisma.workOrder.update({
      where: { id },
      data: {
        status: targetStatus,
      },
      include: {
        location: true,
        item: {
          include: {
            category: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    const stockCheck = await this.computeStockCheck(
      updatedWorkOrder.itemId,
      updatedWorkOrder.locationId,
      updatedWorkOrder.requiredQty
    );

    return {
      ...updatedWorkOrder,
      stockCheck,
    };
  }
}
