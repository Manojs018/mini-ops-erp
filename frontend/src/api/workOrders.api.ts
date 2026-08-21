import { apiClient } from './axios';
import { WorkOrder, WorkOrderStatus, StockCheck, PaginatedResponse } from '../types';

export interface ListWorkOrderParams {
  status?: WorkOrderStatus;
  locationId?: string;
  assignedUserId?: string;
  all?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateWorkOrderParams {
  locationId: string;
  itemId: string;
  requiredQty: number;
  assignedUserId: string;
}

export const workOrdersApi = {
  list: async (params?: ListWorkOrderParams): Promise<PaginatedResponse<WorkOrder>> => {
    const response = await apiClient.get<PaginatedResponse<WorkOrder>>('/work-orders', {
      params,
    });
    return response.data;
  },

  getById: async (id: string): Promise<WorkOrder> => {
    const response = await apiClient.get<WorkOrder>(`/work-orders/${id}`);
    return response.data;
  },

  getStockCheck: async (id: string): Promise<StockCheck> => {
    const response = await apiClient.get<StockCheck>(`/work-orders/${id}/stock-check`);
    return response.data;
  },

  create: async (data: CreateWorkOrderParams): Promise<WorkOrder> => {
    const response = await apiClient.post<WorkOrder>('/work-orders', data);
    return response.data;
  },

  updateStatus: async (id: string, status: WorkOrderStatus): Promise<WorkOrder> => {
    const response = await apiClient.patch<WorkOrder>(`/work-orders/${id}/status`, { status });
    return response.data;
  },
};
