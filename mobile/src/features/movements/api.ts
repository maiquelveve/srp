import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/services/api-client';
import type { MovementType } from './types';

const MOVEMENT_TYPES_CACHE_KEY = 'srp:movement-types-cache';

/**
 * Reference data (movement types) needed to fill in the "registrar saída"
 * form even while offline — cached to `AsyncStorage` on every successful
 * fetch, read back from there when the network call itself fails (research.md #4).
 */
export const movementsApi = {
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
};
