import { useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '@/services/api-client';
import { tokenStorage } from '@/services/token-storage';
import { AuthContext, type AuthUser } from './auth-context';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const AUTH_USER_KEY = 'srp:user';

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem(AUTH_USER_KEY);
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  }, [user]);

  async function login(email: string, password: string): Promise<void> {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password });
    tokenStorage.setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }

  function logout(): void {
    tokenStorage.clear();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}
