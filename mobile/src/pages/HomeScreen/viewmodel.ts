import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/hooks/useAuth';
import { useUnit } from '@/hooks/useUnit';
import { structureApi } from '@/features/structure/api';
import { findUnitById } from '@/features/structure/model';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export function useHomeScreenViewModel(navigation: Navigation) {
  const { user, logout } = useAuth();
  const { unitId } = useUnit();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: structureApi.listUnits });
  const currentUnitName = findUnitById(unitsQuery.data?.data ?? [], unitId)?.name ?? null;

  function goToSelectUnit(): void {
    navigation.navigate('SelectUnit');
  }

  function goToMovement(): void {
    if (unitId === null) {
      navigation.navigate('SelectUnit');
      return;
    }
    navigation.navigate('Galleries', { unitId, unitName: currentUnitName ?? '' });
  }

  function goToProfile(): void {
    navigation.navigate('Profile');
  }

  async function confirmLogout(): Promise<void> {
    setConfirmingLogout(false);
    await logout();
  }

  return {
    userName: user?.name ?? '',
    currentUnitName,
    confirmingLogout,
    requestLogout: () => setConfirmingLogout(true),
    cancelLogout: () => setConfirmingLogout(false),
    confirmLogout,
    goToSelectUnit,
    goToMovement,
    goToProfile,
  };
}
