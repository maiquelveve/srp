import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import { routinesApi } from '@/features/routines/api';
import type { Routine } from '@/features/routines/types';
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

  const routinesQuery = useQuery({
    queryKey: ['routines-today', activeGalleryId],
    queryFn: () => routinesApi.listToday(activeGalleryId as number),
    enabled: activeGalleryId !== null,
  });

  function goToRoutineDetail(routine: Routine): void {
    const galleryCode = galleries.find((gallery) => gallery.id === activeGalleryId)?.code ?? '';
    navigation.navigate('RoutineDetail', { routine, galleryCode });
  }

  return {
    title: `Rotinas: ${unitCode}`,
    goToRoutineDetail,
    galleries,
    selectedGalleryId: activeGalleryId,
    selectGallery: setSelectedGalleryId,
    routines: routinesQuery.data?.data ?? [],
    isLoading: galleriesQuery.isLoading || routinesQuery.isLoading,
  };
}
