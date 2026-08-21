import { apiClient } from './axios';
import { LoginResponse, User } from '../types';

export const authApi = {
  login: async (credentials: { email: string; password: string }): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },
};
