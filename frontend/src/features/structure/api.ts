import { apiClient } from '@/services/api-client';
import type { Cell, Gallery, Inmate, Paginated, Unit } from './types';

export const structureApi = {
  listUnits: () => apiClient.get<Paginated<Unit>>('/units').then((r) => r.data),
  createUnit: (input: { name: string; code?: string }) =>
    apiClient.post<Unit>('/units', input).then((r) => r.data),

  listGalleries: (unitId: number) =>
    apiClient.get<Paginated<Gallery>>(`/units/${unitId}/galleries`).then((r) => r.data),
  createGallery: (input: { unitId: number; code: string; type?: string }) =>
    apiClient.post<Gallery>('/galleries', input).then((r) => r.data),

  listCells: (galleryId: number) =>
    apiClient.get<Paginated<Cell>>(`/galleries/${galleryId}/cells`).then((r) => r.data),
  createCell: (input: { galleryId: number; code: string; capacity: number; type?: string }) =>
    apiClient.post<Cell>('/cells', input).then((r) => r.data),

  listInmates: (params: { cellId?: number; galleryId?: number; status?: string }) =>
    apiClient.get<Paginated<Inmate>>('/inmates', { params }).then((r) => r.data),
  createInmate: (input: { name: string; currentCellId: number; registrationId?: string }) =>
    apiClient.post<Inmate>('/inmates', input).then((r) => r.data),
};
