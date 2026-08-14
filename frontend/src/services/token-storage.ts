const ACCESS_TOKEN_KEY = 'srp:accessToken';
const REFRESH_TOKEN_KEY = 'srp:refreshToken';

/**
 * `window` events AuthContext listens for, so it stays in sync with token
 * state it doesn't own directly (api-client.ts owns the refresh flow).
 * Without this, a failed refresh clears the tokens here but leaves
 * AuthContext's cached `user` truthy — ProtectedRoute never redirects to
 * /login, so the app keeps rendering a "logged in" shell where every
 * authenticated request silently fails (looks like "user has no units/data",
 * but the real cause is a dead session nobody told React about).
 */
export const AUTH_SESSION_EXPIRED_EVENT = 'auth:session-expired';
export const AUTH_USER_REFRESHED_EVENT = 'auth:user-refreshed';

export const tokenStorage = {
  getAccessToken: (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (accessToken: string, refreshToken: string): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },
  clear: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
  },
};
