import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/services/api-client';
import type { MovementType } from './types';

const MOVEMENT_TYPES_CACHE_KEY = 'srp:movement-types-cache';

interface CellTransferInput {
  inmateId: number;
  destinationCellId: number;
  /** Obrigatório para cellSwap (research.md #36) — o backend ignora em cellChange. */
  destinationInmateId?: number;
  reason: string;
  notes?: string;
}

/**
 * Reference data (movement types) needed to fill in the "registrar saída"
 * form even while offline — cached to `AsyncStorage` on every successful
 * fetch, read back from there when the network call itself fails (research.md #4).
 */
export const movementsApi = {
  countOpenMovements: () =>
    apiClient
      .get<{ total: number }>('/movements', { params: { open: 'true' } })
      .then((r) => r.data.total),

  async listTypesWithOfflineCache(): Promise<MovementType[]> {
    try {
      const types = await apiClient.get<MovementType[]>('/movement-types').then((r) => r.data);
      await AsyncStorage.setItem(MOVEMENT_TYPES_CACHE_KEY, JSON.stringify(types));
      return types;
    } catch (error) {
      const cached = await AsyncStorage.getItem(MOVEMENT_TYPES_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as MovementType[];
      }
      throw error;
    }
  },

  // Troca/permuta de cela (mesma galeria, FR-015/FR-015a, research.md #35)
  // — únicas variações acessíveis ao Policial Penal; troca/permuta de
  // galeria são só web (SUPERVISOR/WARDEN, contracts/movements.md).
  cellChange: (input: CellTransferInput) =>
    apiClient.post<{ id: number }>('/movements/cell-change', input).then((r) => r.data),

  cellSwap: (input: CellTransferInput) =>
    apiClient.post<{ id: number }[]>('/movements/cell-swap', input).then((r) => r.data),
};
