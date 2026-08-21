import { apiClient } from './axios';
import { InventoryStock, PaginatedResponse } from '../types';

export interface ListInventoryParams {
  locationId?: string;
  itemId?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}

export interface CreateInventoryParams {
  itemId: string;
  locationId: string;
  batch: string;
  physicalQty: number;
}

export interface AdjustStockParams {
  quantityChange: number;
  reason?: string;
  type?: string;
}

export interface ReportDamageParams {
  quantity: number;
  reason?: string;
}

export const inventoryApi = {
  list: async (params?: ListInventoryParams): Promise<PaginatedResponse<InventoryStock>> => {
    const response = await apiClient.get<PaginatedResponse<InventoryStock>>('/inventory', {
      params,
    });
    return response.data;
  },

  getById: async (id: string): Promise<InventoryStock> => {
    const response = await apiClient.get<InventoryStock>(`/inventory/${id}`);
    return response.data;
  },

  create: async (data: CreateInventoryParams): Promise<InventoryStock> => {
    const response = await apiClient.post<InventoryStock>('/inventory', data);
    return response.data;
  },

  adjust: async (id: string, data: AdjustStockParams): Promise<InventoryStock> => {
    const response = await apiClient.patch<InventoryStock>(`/inventory/${id}/adjust`, data);
    return response.data;
  },

  reportDamage: async (id: string, data: ReportDamageParams): Promise<InventoryStock> => {
    const response = await apiClient.post<InventoryStock>(`/inventory/${id}/report-damage`, data);
    return response.data;
  },
};
