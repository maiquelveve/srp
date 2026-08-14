import { apiClient } from '@/services/api-client';
import type { Cell, CellType, Gallery, GalleryType, Inmate, Paginated, Unit } from './types';

export const structureApi = {
  listUnits: () => apiClient.get<Paginated<Unit>>('/units').then((r) => r.data),
  createUnit: (input: { name: string; code?: string }) =>
    apiClient.post<Unit>('/units', input).then((r) => r.data),
  updateUnit: (id: number, input: { name?: string; code?: string; active?: boolean }) =>
    apiClient.patch<Unit>(`/units/${id}`, input).then((r) => r.data),

  listGalleries: (unitId: number) =>
    apiClient.get<Paginated<Gallery>>(`/units/${unitId}/galleries`).then((r) => r.data),
  createGallery: (input: { unitId: number; code: string; type: GalleryType }) =>
    apiClient.post<Gallery>('/galleries', input).then((r) => r.data),
  updateGallery: (id: number, input: { code?: string; type?: GalleryType; active?: boolean }) =>
    apiClient.patch<Gallery>(`/galleries/${id}`, input).then((r) => r.data),

  listCells: (galleryId: number) =>
    apiClient.get<Paginated<Cell>>(`/galleries/${galleryId}/cells`).then((r) => r.data),
  createCell: (input: { galleryId: number; code: string; capacity: number; type: CellType }) =>
    apiClient.post<Cell>('/cells', input).then((r) => r.data),
  updateCell: (id: number, input: { code?: string; capacity?: number; type?: CellType; active?: boolean }) =>
    apiClient.patch<Cell>(`/cells/${id}`, input).then((r) => r.data),

  listInmates: (params: { cellId?: number; galleryId?: number; status?: string }) =>
    apiClient.get<Paginated<Inmate>>('/inmates', { params }).then((r) => r.data),
  createInmate: (input: { name: string; currentCellId: number; registrationId?: string }) =>
    apiClient.post<Inmate>('/inmates', input).then((r) => r.data),
  updateInmate: (
    id: number,
    input: { name?: string; registrationId?: string; birthDate?: string; custodyRegime?: string; photoUrl?: string },
  ) => apiClient.patch<Inmate>(`/inmates/${id}`, input).then((r) => r.data),
};
