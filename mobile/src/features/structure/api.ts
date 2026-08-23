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
  getInmateById: (id: number) => apiClient.get<Inmate>(`/inmates/${id}`).then((r) => r.data),
  countActiveInmatesByUnit: (unitId: number) =>
    apiClient
      .get<Paginated<Inmate>>('/inmates', { params: { unitId, status: 'ACTIVE' } })
      .then((r) => r.data.total),
  async getUnitOccupancy(unitId: number): Promise<{ capacity: number; occupancy: number }> {
    const galleries = await structureApi.listGalleries(unitId).then((r) => r.data);
    const cellLists = await Promise.all(
      galleries.map((gallery) => structureApi.listCells(gallery.id).then((r) => r.data)),
    );
    const cells = cellLists.flat();
    return {
      capacity: cells.reduce((sum, cell) => sum + cell.capacity, 0),
      occupancy: cells.reduce((sum, cell) => sum + cell.occupancy, 0),
    };
  },
};
