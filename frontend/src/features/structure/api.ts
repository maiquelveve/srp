import { apiClient } from '@/services/api-client';
import type { Cell, Gallery, Inmate, Paginated, Unit } from './types';

export const structureApi = {
  listUnits: () => apiClient.get<Paginated<Unit>>('/units').then((r) => r.data),
  createUnit: (input: { name: string; code?: string }) =>
    apiClient.post<Unit>('/units', input).then((r) => r.data),
  updateUnit: (id: number, input: { name?: string; code?: string; active?: boolean }) =>
    apiClient.patch<Unit>(`/units/${id}`, input).then((r) => r.data),

  listGalleries: (unitId: number) =>
    apiClient.get<Paginated<Gallery>>(`/units/${unitId}/galleries`).then((r) => r.data),
  createGallery: (input: { unitId: number; code: string; type?: string }) =>
    apiClient.post<Gallery>('/galleries', input).then((r) => r.data),
  // TODO(tasks.md T034h follow-up, research.md #21): backend has no
  // PATCH /galleries/:id yet — this is a client-side mock (resolves after a
  // short delay, never touches the network) so the Configurações screen's
  // Editar/Excluir buttons work end-to-end in the UI ahead of the endpoint.
  // Swap for a real `apiClient.patch` once it lands; nothing else in the
  // caller should need to change.
  updateGalleryMock: (gallery: Gallery, input: { code?: string; type?: string; active?: boolean }) =>
    new Promise<Gallery>((resolve) => setTimeout(() => resolve({ ...gallery, ...input }), 400)),

  listCells: (galleryId: number) =>
    apiClient.get<Paginated<Cell>>(`/galleries/${galleryId}/cells`).then((r) => r.data),
  createCell: (input: { galleryId: number; code: string; capacity: number; type?: string }) =>
    apiClient.post<Cell>('/cells', input).then((r) => r.data),
  // TODO(tasks.md T034h follow-up, research.md #21): same as
  // `updateGalleryMock` above, for the missing `PATCH /cells/:id`.
  updateCellMock: (cell: Cell, input: { code?: string; capacity?: number; type?: string; active?: boolean }) =>
    new Promise<Cell>((resolve) => setTimeout(() => resolve({ ...cell, ...input }), 400)),

  listInmates: (params: { cellId?: number; galleryId?: number; status?: string }) =>
    apiClient.get<Paginated<Inmate>>('/inmates', { params }).then((r) => r.data),
  createInmate: (input: { name: string; currentCellId: number; registrationId?: string }) =>
    apiClient.post<Inmate>('/inmates', input).then((r) => r.data),
  updateInmate: (
    id: number,
    input: { name?: string; registrationId?: string; birthDate?: string; custodyRegime?: string; photoUrl?: string },
  ) => apiClient.patch<Inmate>(`/inmates/${id}`, input).then((r) => r.data),
};
