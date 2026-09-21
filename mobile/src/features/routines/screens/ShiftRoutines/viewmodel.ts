import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import { routinesApi } from '@/features/routines/api';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShiftRoutines'>;

export function useShiftRoutinesViewModel({ route }: Props) {
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

  return {
    title: `Rotinas — ${unitCode}`,
    galleries,
    selectedGalleryId: activeGalleryId,
    selectGallery: setSelectedGalleryId,
    routines: routinesQuery.data?.data ?? [],
    isLoading: galleriesQuery.isLoading || routinesQuery.isLoading,
  };
}
