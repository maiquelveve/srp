import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/hooks/useAuth';
import { useUnit } from '@/hooks/useUnit';
import { structureApi } from '@/features/structure/api';
import { findUnitById, occupancyPercentage } from '@/features/structure/model';
import { movementsApi } from '@/features/movements/api';
import type { RootStackParamList } from '@/navigation/types';
import { firstName, greetingForHour } from './model';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export function useHomeScreenViewModel(navigation: Navigation) {
  const { user } = useAuth();
  const { unitId } = useUnit();

  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: structureApi.listUnits });
  const currentUnit = findUnitById(unitsQuery.data?.data ?? [], unitId);
  const currentUnitName = currentUnit?.name ?? null;
  const currentUnitCode = currentUnit?.code ?? null;

  const inmatesCountQuery = useQuery({
    queryKey: ['inmates-count', unitId],
    queryFn: () => structureApi.countActiveInmatesByUnit(unitId as number),
    enabled: unitId !== null,
  });

  const occupancyQuery = useQuery({
    queryKey: ['unit-occupancy', unitId],
    queryFn: () => structureApi.getUnitOccupancy(unitId as number),
    enabled: unitId !== null,
  });

  const openMovementsQuery = useQuery({
    queryKey: ['open-movements-count'],
    queryFn: movementsApi.countOpenMovements,
  });

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

  return {
    userName: user?.name ?? '',
    firstName: firstName(user?.name ?? ''),
    greeting: greetingForHour(new Date().getHours()),
    currentUnitName,
    currentUnitCode,
    inmatesTotal: unitId !== null ? (inmatesCountQuery.data ?? 0) : null,
    occupancyPercent: occupancyQuery.data
      ? occupancyPercentage(occupancyQuery.data.capacity, occupancyQuery.data.occupancy)
      : null,
    openMovementsTotal: openMovementsQuery.data ?? 0,
    goToSelectUnit,
    goToMovement,
    goToProfile,
  };
}
