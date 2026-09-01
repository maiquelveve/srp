import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Cells'>;
type Route = NativeStackScreenProps<RootStackParamList, 'Cells'>['route'];

export function useCellsScreenViewModel(navigation: Navigation, route: Route) {
  const { galleryId, galleryCode } = route.params;

  const cellsQuery = useQuery({
    queryKey: ['cells', galleryId],
    queryFn: () => structureApi.listCells(galleryId),
  });

  function goToInmates(cellId: number, cellCode: string, capacity: number, occupancy: number): void {
    navigation.navigate('Inmates', { cellId, cellCode, capacity, occupancy, galleryId, galleryCode });
  }

  return {
    title: `Galeria ${galleryCode}`,
    cells: cellsQuery.data?.data ?? [],
    isLoading: cellsQuery.isLoading,
    goToInmates,
  };
}
