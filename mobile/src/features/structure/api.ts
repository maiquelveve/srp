import { apiClient } from '@/services/api-client';
import type { Cell, Gallery, Inmate, Paginated, Unit } from './types';

/** Read-only lookup — mobile writes only go through the offline movement queue (FR-011a). */
export const structureApi = {
  listUnits: () => apiClient.get<Paginated<Unit>>('/units').then((r) => r.data),
  listGalleries: (unitId: number) =>
    apiClient.get<Paginated<Gallery>>(`/units/${unitId}/galleries`).then((r) => r.data),
  listCells: (galleryId: number) =>
    apiClient.get<Paginated<Cell>>(`/galleries/${galleryId}/cells`).then((r) => r.data),
  listInmates: (cellId: number) =>
    apiClient.get<Paginated<Inmate>>('/inmates', { params: { cellId } }).then((r) => r.data),
};
