import { apiClient } from './axios';
import { CustomerOrder, CustomerOrderStatus, PaginatedResponse } from '../types';

export interface ListOrderParams {
  status?: CustomerOrderStatus;
  salesUserId?: string;
  all?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateOrderLineInput {
  inventoryStockId: string;
  quantity: number;
}

export interface CreateOrderParams {
  customerName: string;
  lines: CreateOrderLineInput[];
}

export const ordersApi = {
  list: async (params?: ListOrderParams): Promise<PaginatedResponse<CustomerOrder>> => {
    const response = await apiClient.get<PaginatedResponse<CustomerOrder>>('/orders', {
      params,
    });
    return response.data;
  },

  getById: async (id: string): Promise<CustomerOrder> => {
    const response = await apiClient.get<CustomerOrder>(`/orders/${id}`);
    return response.data;
  },

  create: async (data: CreateOrderParams): Promise<CustomerOrder> => {
    const response = await apiClient.post<CustomerOrder>('/orders', data);
    return response.data;
  },

  cancel: async (id: string): Promise<CustomerOrder> => {
    const response = await apiClient.patch<CustomerOrder>(`/orders/${id}/cancel`);
    return response.data;
  },
};
