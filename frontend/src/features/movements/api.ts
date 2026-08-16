import { apiClient } from '@/services/api-client';
import type { Paginated } from '../structure/types';
import type { Movement, MovementType } from './types';

export const movementsApi = {
  listTypes: () => apiClient.get<MovementType[]>('/movement-types').then((r) => r.data),

  createTemporary: (input: {
    inmateId: number;
    movementTypeId: number;
    originCellId: number;
    destinationLocation: string;
    reason?: string;
    notes?: string;
  }) => apiClient.post<Movement>('/movements', input).then((r) => r.data),

  update: (
    movementId: number,
    input: { movementTypeId?: number; destinationLocation?: string; reason?: string; notes?: string },
  ) => apiClient.patch<Movement>(`/movements/${movementId}`, input).then((r) => r.data),

  returnMovement: (movementId: number) =>
    apiClient.patch<Movement>(`/movements/${movementId}/return`, {}).then((r) => r.data),

  list: (params: { inmateId?: number; open?: boolean }) =>
    apiClient.get<Paginated<Movement>>('/movements', { params }).then((r) => r.data),
};
