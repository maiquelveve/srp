import { apiClient } from '@/services/api-client';
import type { Paginated, RoleName } from '@/features/structure/types';
import type { AdminUser, CreateUserInput, PasswordActionResult, UpdateUserInput } from './types';

export interface ListUsersParams {
  unitId?: number;
  role?: RoleName;
  active?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export const usersApi = {
  list: (params: ListUsersParams = {}) =>
    apiClient.get<Paginated<AdminUser>>('/users', { params }).then((r) => r.data),
  create: (input: CreateUserInput) => apiClient.post<AdminUser>('/users', input).then((r) => r.data),
  update: (id: number, input: UpdateUserInput) =>
    apiClient.patch<AdminUser>(`/users/${id}`, input).then((r) => r.data),
  deactivate: (id: number) => apiClient.patch<AdminUser>(`/users/${id}/deactivate`).then((r) => r.data),
  reactivate: (id: number) => apiClient.patch<AdminUser>(`/users/${id}/reactivate`).then((r) => r.data),
  replaceUnits: (id: number, unitIds: number[]) =>
    apiClient.put<AdminUser>(`/users/${id}/units`, { unitIds }).then((r) => r.data),
  addUnits: (id: number, unitIds: number[]) =>
    apiClient.post<AdminUser>(`/users/${id}/units`, { unitIds }).then((r) => r.data),
  resetPassword: (id: number) =>
    apiClient.patch<PasswordActionResult>(`/users/${id}/reset-password`).then((r) => r.data),
  resendPasswordEmail: (id: number) =>
    apiClient.post<PasswordActionResult>(`/users/${id}/resend-password-email`).then((r) => r.data),
};
