import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User, Role } from '../types';
import { authApi } from '../api/auth.api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('min_erp_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('min_erp_token')
  );

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore authenticated session on initial app load
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('min_erp_token');
      if (savedToken) {
        try {
          const freshUser = await authApi.getMe();
          setUser(freshUser);
          localStorage.setItem('min_erp_user', JSON.stringify(freshUser));
        } catch {
          // Clear invalid stored session
          localStorage.removeItem('min_erp_token');
          localStorage.removeItem('min_erp_user');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: { email: string; password: string }): Promise<User> => {
    const response = await authApi.login(credentials);
    const { token: jwtToken, user: loggedUser } = response;

    localStorage.setItem('min_erp_token', jwtToken);
    localStorage.setItem('min_erp_user', JSON.stringify(loggedUser));

    setToken(jwtToken);
    setUser(loggedUser);

    return loggedUser;
  };

  const logout = () => {
    localStorage.removeItem('min_erp_token');
    localStorage.removeItem('min_erp_user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const freshUser = await authApi.getMe();
      setUser(freshUser);
      localStorage.setItem('min_erp_user', JSON.stringify(freshUser));
    } catch {
      // Ignored if unauthenticated
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user ? user.role : null,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
