import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/hooks/useAuth';
import { useUnit } from '@/hooks/useUnit';
import { structureApi } from '@/features/structure/api';
import { filterUnitsByIds, filterUnitsBySearch } from '@/features/structure/model';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'SelectUnit'>;

export function useSelectUnitScreenViewModel(navigation: Navigation) {
  const { user } = useAuth();
  const { unitId, setUnitId } = useUnit();
  const [search, setSearch] = useState('');
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: structureApi.listUnits });

  const linkedUnits = filterUnitsByIds(unitsQuery.data?.data ?? [], user?.units ?? []);
  const units = filterUnitsBySearch(linkedUnits, search);

  async function selectUnit(id: number): Promise<void> {
    await setUnitId(id);
    navigation.goBack();
  }

  return {
    units,
    hasAnyUnit: linkedUnits.length > 0,
    search,
    setSearch,
    currentUnitId: unitId,
    isLoading: unitsQuery.isLoading,
    selectUnit,
  };
}
