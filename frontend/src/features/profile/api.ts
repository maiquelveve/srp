import { apiClient } from '@/services/api-client';

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  /** Refresh token do dispositivo atual — preservado da revogação (contracts/auth.md, FR-017a). */
  refreshToken: string;
}

export const profileApi = {
  changePassword: (input: ChangePasswordInput) =>
    apiClient.patch<{ message: string }>('/auth/change-password', input).then((r) => r.data),
};
