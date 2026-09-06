import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Cells'>;
type Route = NativeStackScreenProps<RootStackParamList, 'Cells'>['route'];

export function useCellsScreenViewModel(navigation: Navigation, route: Route) {
  const { galleryId, galleryCode } = route.params;
  const queryClient = useQueryClient();

  const cellsQuery = useQuery({
    queryKey: ['cells', galleryId],
    queryFn: () => structureApi.listCells(galleryId),
  });

  // Mesmo problema e mesma solução do InmatesScreen: as telas de troca/permuta
  // ficam empilhadas por cima desta (native-stack não a desmonta), então o
  // invalidateQueries disparado no handleConfirm de cada fluxo não é
  // suficiente sozinho — refaz aqui a cada foco pra ocupação do card (origem
  // e destino) vir sempre atualizada ao voltar pra esta tela.
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['cells', galleryId] });
    }, [queryClient, galleryId]),
  );

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
