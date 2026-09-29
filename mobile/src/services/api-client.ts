import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from './token-storage';
import { notifySessionExpired } from './session-events';
import { classifyUnauthorizedResponse } from '@/lib/unauthorized';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

/**
 * Shared HTTP client (contracts/auth.md). Attaches the access token to every
 * request and transparently rotates it via /auth/refresh on a single 401
 * retry — mirrors frontend/src/services/api-client.ts, storage swapped for
 * AsyncStorage (research.md #11).
 */
export const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use(async (config) => {
  const accessToken = await tokenStorage.getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  const response = await axios.post<{ accessToken: string; refreshToken: string }>(
    `${API_BASE_URL}/auth/refresh`,
    { refreshToken },
  );
  await tokenStorage.setTokens(response.data.accessToken, response.data.refreshToken);
  return response.data.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    const outcome = classifyUnauthorizedResponse(error.response?.status, Boolean(originalRequest._retried));

    if (outcome === 'not-unauthorized') {
      return Promise.reject(error);
    }

    if (outcome === 'session-expired') {
      // As pendências da fila offline (mobile/src/offline/) não são apagadas
      // aqui — permanecem no aparelho pro mesmo usuário sincronizar ao
      // entrar de novo (FR-011a, spec.md).
      await tokenStorage.clear();
      notifySessionExpired();
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
      await tokenStorage.clear();
      notifySessionExpired();
      return Promise.reject(refreshError);
    }
  },
);
