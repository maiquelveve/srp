import { useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/services/api-client';
import { tokenStorage } from '@/services/token-storage';
import { resetSessionExpired, subscribeSessionExpired } from '@/services/session-events';
import { AuthContext, type AuthUser } from './auth-context';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const AUTH_USER_KEY = 'srp:user';

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void AsyncStorage.getItem(AUTH_USER_KEY).then((stored) => {
      if (stored) {
        setUser(JSON.parse(stored) as AuthUser);
      }
      setIsLoading(false);
    });
  }, []);

  // Sessão encerrada pelo servidor (401 mesmo após renovar o token — ex.:
  // usuário desativado, T128, research.md #55): o `api-client` dispara o
  // evento, aqui só se assina pra derrubar o usuário logado e voltar pro
  // login. A fila offline (mobile/src/offline/) não é tocada, então continua
  // intacta pro mesmo usuário sincronizar ao entrar de novo (FR-011a).
  useEffect(() => {
    return subscribeSessionExpired(() => {
      void logout();
    });
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', { email, password });
    await tokenStorage.setTokens(data.accessToken, data.refreshToken);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
    resetSessionExpired();
    setUser(data.user);
  }

  async function logout(): Promise<void> {
    await tokenStorage.clear();
    await AsyncStorage.removeItem(AUTH_USER_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
