import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import { resolveListLoadState } from '@/lib/list-load-state';
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
  const cells = cellsQuery.data?.data ?? [];

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
    cells,
    // Loading/erro/vazio de verdade (T130, research.md #55) — sem isso, uma
    // falha de carga virava "nenhuma cela cadastrada".
    loadState: resolveListLoadState({
      isLoading: cellsQuery.isLoading,
      isError: cellsQuery.isError,
      hasData: cellsQuery.data !== undefined,
      isEmpty: cells.length === 0,
    }),
    errorMessage: 'Não foi possível carregar as celas. Verifique a conexão e tente de novo.',
    retry: () => void cellsQuery.refetch(),
    goToInmates,
  };
}
