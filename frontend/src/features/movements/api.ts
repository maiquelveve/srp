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
    /** Obrigatório (FR-008a, research.md #35). */
    reason: string;
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

  // Liberdade/tornozeleira/transferência (US3, contracts/movements.md) —
  // WARDEN only. Estruturalmente idênticas — reason/notes (research.md #35).
  finalRelease: (input: { inmateId: number; reason: string; notes?: string }) =>
    apiClient.post<Movement>('/movements/final/release', input).then((r) => r.data),

  finalAnkleMonitor: (input: { inmateId: number; reason: string; notes?: string }) =>
    apiClient.post<Movement>('/movements/final/ankle-monitor', input).then((r) => r.data),

  finalTransfer: (input: { inmateId: number; reason: string; notes?: string }) =>
    apiClient.post<Movement>('/movements/final/transfer', input).then((r) => r.data),

  // Reversão de liberdade/tornozeleira/transferência registrada por engano
  // (FR-016a) — WARDEN only. O preso volta a ACTIVE na cela escolhida (com vaga).
  finalReversal: (input: { inmateId: number; destinationCellId: number; reason: string; notes?: string }) =>
    apiClient.post<Movement>('/movements/final/reversal', input).then((r) => r.data),

  // Troca/permuta de cela/galeria (research.md #35, FR-015–FR-015c). Troca/
  // permuta de cela: qualquer perfil. Troca/permuta de galeria: SUPERVISOR/
  // WARDEN só (o backend também aplica essa regra via @Roles).
  cellChange: (input: CellTransferInput) =>
    apiClient.post<Movement>('/movements/cell-change', input).then((r) => r.data),

  cellSwap: (input: CellTransferInput) =>
    apiClient.post<Movement[]>('/movements/cell-swap', input).then((r) => r.data),

  galleryChange: (input: CellTransferInput) =>
    apiClient.post<Movement>('/movements/gallery-change', input).then((r) => r.data),

  gallerySwap: (input: CellTransferInput) =>
    apiClient.post<Movement[]>('/movements/gallery-swap', input).then((r) => r.data),
};

interface CellTransferInput {
  inmateId: number;
  destinationCellId: number;
  /** Obrigatório para cell-swap/gallery-swap (research.md #36) — o backend ignora em cell-change/gallery-change. */
  destinationInmateId?: number;
  reason: string;
  notes?: string;
}
