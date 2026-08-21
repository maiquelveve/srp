import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import type { Inmate } from '@/features/structure/types';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Inmates'>;
type Route = NativeStackScreenProps<RootStackParamList, 'Inmates'>['route'];

export function useInmatesScreenViewModel(navigation: Navigation, route: Route) {
  const { cellId, cellCode, capacity, occupancy } = route.params;

  const inmatesQuery = useQuery({
    queryKey: ['inmates', cellId],
    queryFn: () => structureApi.listInmates(cellId),
  });

  function statusLine(inmate: Inmate): string {
    if (!inmate.inMovement) return inmate.status;
    return `${inmate.status} — fora da cela (${inmate.currentMovement?.movementTypeName ?? '—'})`;
  }

  function movementActionLabel(inmate: Inmate): string {
    return inmate.inMovement ? 'Retorno' : 'Saída';
  }

  function goToDetail(inmateId: number): void {
    navigation.navigate('InmateDetail', { inmateId });
  }

  function goToMovementRegister(inmate: Inmate): void {
    navigation.navigate('MovementRegister', { inmate, cellId });
  }

  return {
    title: `Cela ${cellCode}`,
    dateLabel: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
    occupancyLabel: `${occupancy}/${capacity} presos`,
    inmates: inmatesQuery.data?.data ?? [],
    isLoading: inmatesQuery.isLoading,
    statusLine,
    movementActionLabel,
    goToDetail,
    goToMovementRegister,
  };
}
