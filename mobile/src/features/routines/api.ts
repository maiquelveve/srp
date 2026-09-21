import { apiClient } from '@/services/api-client';
import type { Paginated } from '@/features/structure/types';
import type { Routine } from './types';

/** Read-only (FR-020) — mobile has no rotinas write path, só web (contracts/routines.md). */
export const routinesApi = {
  listToday: (galleryId: number) =>
    apiClient.get<Paginated<Routine>>('/routines', { params: { galleryId } }).then((r) => r.data),
};
