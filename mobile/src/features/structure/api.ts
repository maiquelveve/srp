import { apiClient } from '@/services/api-client';
import type { Cell, Gallery, GalleryWithStats, Inmate, Paginated, Unit } from './types';

/** Read-only lookup — mobile writes only go through the offline movement queue (FR-011a). */
export const structureApi = {
  listUnits: () => apiClient.get<Paginated<Unit>>('/units').then((r) => r.data),
  listGalleries: (unitId: number) =>
    apiClient.get<Paginated<Gallery>>(`/units/${unitId}/galleries`).then((r) => r.data),
  listCells: (galleryId: number) =>
    apiClient.get<Paginated<Cell>>(`/galleries/${galleryId}/cells`).then((r) => r.data),
  async listGalleriesWithStats(unitId: number): Promise<GalleryWithStats[]> {
    const galleries = await structureApi.listGalleries(unitId).then((r) => r.data);
    const cellLists = await Promise.all(
      galleries.map((gallery) => structureApi.listCells(gallery.id).then((r) => r.data)),
    );
    return galleries.map((gallery, index) => {
      const cells = cellLists[index];
      return {
        ...gallery,
        cellCount: cells.length,
        capacity: cells.reduce((sum, cell) => sum + cell.capacity, 0),
        occupancy: cells.reduce((sum, cell) => sum + cell.occupancy, 0),
      };
    });
  },
  // `status: 'ACTIVE'` é obrigatório aqui — sem ele a listagem também traz
  // presos com situação definitiva já registrada (liberado/tornozeleira/
  // transferido/óbito), que continuam com `currentCellId` apontando pra essa
  // cela (é o timeline de FR-016). Sem o filtro, a lista mostra mais presos
  // do que a ocupação real da cela (backend já conta só ACTIVE em
  // `CellsService.occupancyOf`), dando a falsa impressão de que a contagem
  // de vagas está errada — mesmo bug corrigido no web (GalleryCards).
  listInmates: (cellId: number) =>
    apiClient
      .get<Paginated<Inmate>>('/inmates', { params: { cellId, status: 'ACTIVE' } })
      .then((r) => r.data),
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
