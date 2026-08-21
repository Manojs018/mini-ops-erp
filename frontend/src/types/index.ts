export type Role = 'ADMIN' | 'OPERATIONS' | 'SALES';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  locationId?: string | null;
  location?: Location;
}

export interface Location {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Item {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  category?: Category;
}

export interface InventoryStock {
  id: string;
  itemId: string;
  locationId: string;
  batch: string;
  physicalQty: number;
  reservedQty: number;
  availableQty: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  item?: Item;
  location?: Location;
}

export type InventoryTransactionType =
  | 'RECEIPT'
  | 'ISSUE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'RESERVE'
  | 'RELEASE'
  | 'ADJUSTMENT'
  | 'DAMAGE';

export interface InventoryTransaction {
  id: string;
  inventoryStockId: string;
  type: InventoryTransactionType;
  quantity: number;
  referenceType: string;
  referenceId: string;
  idempotencyKey: string;
  createdAt: string;
}

export type WorkOrderStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';

export interface StockCheck {
  requiredQty: number;
  availableQtyAtLocation: number;
  shortage: number;
}

export interface WorkOrder {
  id: string;
  locationId: string;
  location?: Location;
  itemId: string;
  item?: Item;
  requiredQty: number;
  assignedUserId: string;
  assignedUser?: User;
  status: WorkOrderStatus;
  createdAt: string;
  stockCheck?: StockCheck;
}

export type StockTransferStatus = 'REQUESTED' | 'DISPATCHED' | 'PARTIALLY_RECEIVED' | 'RECEIVED';

export interface StockTransfer {
  id: string;
  sourceLocationId: string;
  sourceLocation?: Location;
  destinationLocationId: string;
  destinationLocation?: Location;
  itemId: string;
  item?: Item;
  quantity: number;
  receivedQty: number;
  remainingQty: number;
  status: StockTransferStatus;
  dispatchedAt?: string | null;
  receivedAt?: string | null;
  createdAt: string;
}

export type CustomerOrderStatus = 'RESERVED' | 'CANCELLED' | 'FULFILLED';

export interface CustomerOrderLine {
  id: string;
  customerOrderId: string;
  itemId: string;
  item?: Item;
  locationId: string;
  location?: Location;
  inventoryStockId: string;
  inventoryStock?: InventoryStock;
  quantity: number;
}

export interface CustomerOrder {
  id: string;
  customerName: string;
  salesUserId: string;
  salesUser?: User;
  status: CustomerOrderStatus;
  createdAt: string;
  lines: CustomerOrderLine[];
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

export interface APIError {
  error: {
    message: string;
    statusCode: number;
  };
}

export interface LoginResponse {
  token: string;
  user: User;
}
