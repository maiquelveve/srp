import { useQuery } from '@tanstack/react-query';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import type { RootStackParamList } from '@/navigation/types';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Galleries'>;
type Route = NativeStackScreenProps<RootStackParamList, 'Galleries'>['route'];

export function useGalleriesScreenViewModel(navigation: Navigation, route: Route) {
  const { unitId, unitName } = route.params;

  const galleriesQuery = useQuery({
    queryKey: ['galleries', unitId],
    queryFn: () => structureApi.listGalleriesWithStats(unitId),
  });

  function goToCells(galleryId: number, galleryCode: string): void {
    navigation.navigate('Cells', { galleryId, galleryCode });
  }

  return {
    title: unitName || 'Galerias',
    galleries: galleriesQuery.data ?? [],
    isLoading: galleriesQuery.isLoading,
    goToCells,
  };
}
