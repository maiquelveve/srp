import { useQuery } from '@tanstack/react-query';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import { inmateMovementActionLabel, inmateStatusLine } from '@/features/structure/model';
import type { Inmate } from '@/features/structure/types';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Inmates'>;
type Route = NativeStackScreenProps<RootStackParamList, 'Inmates'>['route'];

export function useInmatesScreenViewModel(navigation: Navigation, route: Route) {
  const { cellId, cellCode, capacity, occupancy, galleryCode } = route.params;

  const inmatesQuery = useQuery({
    queryKey: ['inmates', cellId],
    queryFn: () => structureApi.listInmates(cellId),
  });

  function goToDetail(inmateId: number): void {
    navigation.navigate('InmateDetail', { inmateId, cellCode, galleryCode });
  }

  function goToMovementRegister(inmate: Inmate): void {
    navigation.navigate('MovementRegister', { inmate, cellId });
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
    statusLine: inmateStatusLine,
    movementActionLabel: inmateMovementActionLabel,
    goToDetail,
    goToMovementRegister,
  };
}
