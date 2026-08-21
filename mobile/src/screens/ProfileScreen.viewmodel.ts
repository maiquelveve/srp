import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { structureApi } from '@/features/structure/api';
import type { RoleName } from '@/contexts/auth-context';

const ROLE_LABEL: Record<RoleName, string> = {
  PRISON_OFFICER: 'Policial Penal',
  SUPERVISOR: 'Supervisor',
  WARDEN: 'Chefia/Diretor',
};

export function useProfileScreenViewModel() {
  const { user } = useAuth();
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: structureApi.listUnits });

  const unitNames = (unitsQuery.data?.data ?? [])
    .filter((u) => user?.units.includes(u.id))
    .map((u) => u.name);

  return {
    name: user?.name ?? '',
    roleLabel: user ? ROLE_LABEL[user.role] : '',
    unitNames,
  };
}
