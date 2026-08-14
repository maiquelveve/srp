import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { tokenStorage, AUTH_USER_REFRESHED_EVENT } from './token-storage';
import type { AuthUser } from '@/contexts/auth-context';

/**
 * Shared HTTP client (contracts/auth.md). Attaches the access token to every
 * request and transparently rotates it via /auth/refresh on a single 401
 * retry — matches TokenService's rotation on the backend (research.md #11).
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const accessToken = tokenStorage.getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  const response = await axios.post<{ accessToken: string; refreshToken: string; user: AuthUser }>(
    `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
    { refreshToken },
  );
  tokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
  // /auth/refresh returns the same fresh `user` (incl. `units`) as /auth/login
  // — keep AuthContext's cached copy in sync instead of freezing it at
  // whatever it was during the original login.
  window.dispatchEvent(new CustomEvent(AUTH_USER_REFRESHED_EVENT, { detail: response.data.user }));
  return response.data.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retried) {
      if (error.response?.status === 401) {
        tokenStorage.clear();
      }
      return Promise.reject(error);
    }

    originalRequest._retried = true;

    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const accessToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      tokenStorage.clear();
      return Promise.reject(refreshError);
    }
  },
);
