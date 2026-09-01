import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import { inmateMovementActionLabel, inmateStatusLine } from '@/features/structure/model';
import type { Inmate } from '@/features/structure/types';
import type { RootStackParamList } from '@/navigation/types';
import { countPending } from '@/offline/offline-queue';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Inmates'>;
type Route = NativeStackScreenProps<RootStackParamList, 'Inmates'>['route'];

export function useInmatesScreenViewModel(navigation: Navigation, route: Route) {
  const { cellId, cellCode, capacity, occupancy, galleryId, galleryCode } = route.params;

  const inmatesQuery = useQuery({
    queryKey: ['inmates', cellId],
    queryFn: () => structureApi.listInmates(cellId),
  });

  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      countPending().then(setPendingSyncCount);
    }, []),
  );

  function goToDetail(inmateId: number): void {
    navigation.navigate('InmateDetail', { inmateId, cellCode, galleryCode });
  }

  function goToMovementRegister(inmate: Inmate): void {
    navigation.navigate('MovementRegister', { inmate, cellId });
  }

  function goToCellTransferSelect(inmate: Inmate): void {
    navigation.navigate('CellTransferSelect', { inmate, cellId, galleryId, galleryCode });
  }

  return {
    title: `Galeria ${galleryCode}   /   Cela ${cellCode}`.toUpperCase(),
    dateLabel: new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    occupancyLabel: `${occupancy}/${capacity} presos`,
    inmates: inmatesQuery.data?.data ?? [],
    isLoading: inmatesQuery.isLoading,
    pendingSyncCount,
    statusLine: inmateStatusLine,
    movementActionLabel: inmateMovementActionLabel,
    goToDetail,
    goToMovementRegister,
    goToCellTransferSelect,
  };
}
