import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import { routinesApi } from '@/features/routines/api';
import type { Routine } from '@/features/routines/types';
import { resolveListLoadState, type ListLoadState } from '@/lib/list-load-state';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShiftRoutines'>;

export function useShiftRoutinesViewModel({ navigation, route }: Props) {
  const { unitId, unitCode } = route.params;
  const [selectedGalleryId, setSelectedGalleryId] = useState<number | null>(null);

  const galleriesQuery = useQuery({
    queryKey: ['galleries', unitId],
    queryFn: () => structureApi.listGalleries(unitId),
  });

  const galleries = galleriesQuery.data?.data ?? [];
  const activeGalleryId = selectedGalleryId ?? galleries[0]?.id ?? null;
  const galleriesLoadState = resolveListLoadState({
    isLoading: galleriesQuery.isLoading,
    isError: galleriesQuery.isError,
    hasData: galleriesQuery.data !== undefined,
    isEmpty: galleries.length === 0,
  });

  const routinesQuery = useQuery({
    queryKey: ['routines-today', activeGalleryId],
    queryFn: () => routinesApi.listToday(activeGalleryId as number),
    enabled: activeGalleryId !== null,
  });
  const routines = routinesQuery.data?.data ?? [];

  // Sem galeria nenhuma carregada (erro ou ainda carregando) não dá nem pra
  // escolher uma pra ver as rotinas — a tela inteira reflete isso, em vez de
  // deixar a lista de rotinas mostrar "vazio" por baixo de um erro que é das
  // galerias (T130, research.md #55).
  let routinesLoadState: ListLoadState;
  if (galleriesLoadState === 'error' || galleriesLoadState === 'loading') {
    routinesLoadState = galleriesLoadState;
  } else {
    routinesLoadState = resolveListLoadState({
      isLoading: routinesQuery.isLoading,
      isError: routinesQuery.isError,
      hasData: routinesQuery.data !== undefined,
      isEmpty: routines.length === 0,
    });
  }

  function goToRoutineDetail(routine: Routine): void {
    const galleryCode = galleries.find((gallery) => gallery.id === activeGalleryId)?.code ?? '';
    navigation.navigate('RoutineDetail', { routine, galleryCode });
  }

  return {
    title: `Rotinas: ${unitCode}`,
    goToRoutineDetail,
    galleries,
    galleriesLoadState,
    galleriesErrorMessage: 'Não foi possível carregar as galerias. Verifique a conexão e tente de novo.',
    retryGalleries: () => void galleriesQuery.refetch(),
    selectedGalleryId: activeGalleryId,
    selectGallery: setSelectedGalleryId,
    routines,
    routinesLoadState,
    routinesErrorMessage: 'Não foi possível carregar as rotinas. Verifique a conexão e tente de novo.',
    retryRoutines: () => void routinesQuery.refetch(),
  };
}
