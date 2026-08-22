import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { structureApi } from '@/features/structure/api';
import { filterUnitsByIds } from '@/features/structure/model';
import { roleLabel } from './model';

export function useProfileScreenViewModel() {
  const { user } = useAuth();
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: structureApi.listUnits });

  const unitNames = filterUnitsByIds(unitsQuery.data?.data ?? [], user?.units ?? []).map(
    (u) => u.name,
  );

  return {
    name: user?.name ?? '',
    roleLabel: user ? roleLabel(user.role) : '',
    unitNames,
  };
}
