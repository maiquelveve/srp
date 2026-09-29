import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import { resolveListLoadState } from '@/lib/list-load-state';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Galleries'>;
type Route = NativeStackScreenProps<RootStackParamList, 'Galleries'>['route'];

export function useGalleriesScreenViewModel(navigation: Navigation, route: Route) {
  const { unitId, unitName } = route.params;

  const galleriesQuery = useQuery({
    queryKey: ['galleries', unitId],
    queryFn: () => structureApi.listGalleriesWithStats(unitId),
  });
  const galleries = galleriesQuery.data ?? [];

  function goToCells(galleryId: number, galleryCode: string): void {
    navigation.navigate('Cells', { galleryId, galleryCode });
  }

  return {
    title: unitName || 'Galerias',
    galleries,
    // Loading/erro/vazio de verdade (T130, research.md #55) — sem isso, uma
    // falha de carga virava "nenhuma galeria cadastrada".
    loadState: resolveListLoadState({
      isLoading: galleriesQuery.isLoading,
      isError: galleriesQuery.isError,
      hasData: galleriesQuery.data !== undefined,
      isEmpty: galleries.length === 0,
    }),
    errorMessage: 'Não foi possível carregar as galerias. Verifique a conexão e tente de novo.',
    retry: () => void galleriesQuery.refetch(),
    goToCells,
  };
}
