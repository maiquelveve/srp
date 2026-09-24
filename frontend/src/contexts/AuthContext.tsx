import { useEffect, useState, type ReactNode } from 'react';
import { apiClient } from '@/services/api-client';
import {
  tokenStorage,
  AUTH_SESSION_EXPIRED_EVENT,
  AUTH_USER_REFRESHED_EVENT,
} from '@/services/token-storage';
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

  // api-client.ts owns the token refresh flow and can't touch this
  // component's state directly — it reports outcomes via these events
  // instead, so a dead session actually logs the user out (redirecting via
  // ProtectedRoute) instead of leaving a stale "logged in" shell around, and
  // a successful refresh keeps `units`/`role` in sync with the backend.
  useEffect(() => {
    function handleSessionExpired(): void {
      setUser(null);
    }
    function handleUserRefreshed(event: Event): void {
      setUser((event as CustomEvent<AuthUser>).detail);
    }
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    window.addEventListener(AUTH_USER_REFRESHED_EVENT, handleUserRefreshed);
    return () => {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
      window.removeEventListener(AUTH_USER_REFRESHED_EVENT, handleUserRefreshed);
    };
  }, []);

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
