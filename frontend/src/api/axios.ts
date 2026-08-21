import axios, { AxiosError } from 'axios';
import type { APIError } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Bearer Token from localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('min_erp_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Handle 401 Unauthenticated & Parse Centralized Backend Error
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<APIError>) => {
    if (error.response?.status === 401) {
      // Clear invalid session if unauthenticated (unless on login path)
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('min_erp_token');
        localStorage.removeItem('min_erp_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Utility to extract clean, user-friendly error messages from backend responses.
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const apiErr = error.response?.data as APIError | undefined;
    if (apiErr?.error?.message) {
      return apiErr.error.message;
    }
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      return `Cannot connect to backend API server at ${API_BASE_URL}. Please start the backend using 'npm run dev' inside the backend/ directory.`;
    }
    if (error.message) {
      return error.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}
