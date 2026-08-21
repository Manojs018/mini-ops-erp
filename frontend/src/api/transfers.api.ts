import { apiClient } from './axios';
import { StockTransfer, StockTransferStatus, PaginatedResponse } from '../types';

export interface ListTransferParams {
  status?: StockTransferStatus;
  sourceLocationId?: string;
  destinationLocationId?: string;
  itemId?: string;
  page?: number;
  limit?: number;
}

export interface CreateTransferParams {
  sourceLocationId: string;
  destinationLocationId: string;
  itemId: string;
  quantity: number;
}

export const transfersApi = {
  list: async (params?: ListTransferParams): Promise<PaginatedResponse<StockTransfer>> => {
    const response = await apiClient.get<PaginatedResponse<StockTransfer>>('/transfers', {
      params,
    });
    return response.data;
  },

  getById: async (id: string): Promise<StockTransfer> => {
    const response = await apiClient.get<StockTransfer>(`/transfers/${id}`);
    return response.data;
  },

  create: async (data: CreateTransferParams): Promise<StockTransfer> => {
    const response = await apiClient.post<StockTransfer>('/transfers', data);
    return response.data;
  },

  dispatch: async (id: string, idempotencyKey?: string): Promise<StockTransfer> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['x-idempotency-key'] = idempotencyKey;
    }
    const response = await apiClient.patch<StockTransfer>(`/transfers/${id}/dispatch`, {}, { headers });
    return response.data;
  },

  receive: async (id: string, quantity?: number, idempotencyKey?: string): Promise<StockTransfer> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['x-idempotency-key'] = idempotencyKey;
    }
    const body = quantity !== undefined ? { quantity } : {};
    const response = await apiClient.patch<StockTransfer>(`/transfers/${id}/receive`, body, { headers });
    return response.data;
  },
};
