import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { structureApi } from '@/features/structure/api';
import { filterUnitsByIds } from '@/features/structure/model';
import { roleLabel } from './model';

export function useProfileScreenViewModel() {
  const { user, logout } = useAuth();
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: structureApi.listUnits });
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const unitNames = filterUnitsByIds(unitsQuery.data?.data ?? [], user?.units ?? []).map(
    (u) => u.name,
  );

  async function confirmLogout(): Promise<void> {
    setConfirmingLogout(false);
    await logout();
  }

  return {
    name: user?.name ?? '',
    email: user?.email ?? '',
    badgeNumber: user?.badgeNumber ?? null,
    jobTitle: user?.jobTitle ?? null,
    roleLabel: user ? roleLabel(user.role) : '',
    unitNames,
    confirmingLogout,
    requestLogout: () => setConfirmingLogout(true),
    cancelLogout: () => setConfirmingLogout(false),
    confirmLogout,
  };
}
