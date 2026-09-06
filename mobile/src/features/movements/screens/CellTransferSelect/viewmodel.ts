import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'CellTransferSelect'>;
type Route = NativeStackScreenProps<RootStackParamList, 'CellTransferSelect'>['route'];

/**
 * Disponibilidade de cada tipo de troca, checada assim que a tela abre —
 * mesmo critério do web (`CellTransferDialog`, research.md #35 "Decision —
 * UI"): sem isso, o usuário entra num fluxo cujo passo 1 (lista de celas)
 * aparece vazio sem explicação, parecendo um bug.
 */
export function useCellTransferSelectViewModel(navigation: Navigation, route: Route) {
  const { inmate, cellId, cellCode, galleryId, galleryCode } = route.params;

  const cellsQuery = useQuery({
    queryKey: ['cells', galleryId],
    queryFn: () => structureApi.listCells(galleryId),
  });
  const homeCells = (cellsQuery.data?.data ?? []).filter((cell) => cell.id !== cellId);
  const checkingAvailability = cellsQuery.isLoading;
  const cellChangeAvailable = homeCells.some((cell) => cell.occupancy < cell.capacity);
  const cellSwapAvailable = homeCells.some((cell) => cell.occupancy > 0);

  function goToCellChange(): void {
    navigation.navigate('CellChange', { inmate, cellId, cellCode, galleryId, galleryCode });
  }

  function goToCellSwap(): void {
    navigation.navigate('CellSwap', { inmate, cellId, cellCode, galleryId, galleryCode });
  }

  return {
    inmate,
    checkingAvailability,
    cellChangeAvailable,
    cellSwapAvailable,
    goToCellChange,
    goToCellSwap,
  };
}
