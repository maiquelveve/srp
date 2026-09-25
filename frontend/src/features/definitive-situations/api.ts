import { apiClient } from '@/services/api-client';
import type { Paginated } from '../structure/types';
import type { DefinitiveSituation, SituationPeriod } from './types';

export const definitiveSituationsApi = {
  list: (params: {
    unitId: number;
    period: SituationPeriod;
    name?: string;
    registrationId?: string;
    limit: number;
    offset: number;
  }) =>
    apiClient
      .get<Paginated<DefinitiveSituation>>('/movements/definitive-situations', { params })
      .then((r) => r.data),
};
