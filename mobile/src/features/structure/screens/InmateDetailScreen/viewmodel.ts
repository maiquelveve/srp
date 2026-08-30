import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { structureApi } from '@/features/structure/api';
import type { RootStackParamList } from '@/navigation/types';

type Route = NativeStackScreenProps<RootStackParamList, 'InmateDetail'>['route'];

/** Somente leitura — registrar situação definitiva é restrito à Chefia/Diretor no web (US3). */
export function useInmateDetailScreenViewModel(route: Route) {
  const { inmateId, cellCode, galleryCode } = route.params;

  const inmateQuery = useQuery({
    queryKey: ['inmate', inmateId],
    queryFn: () => structureApi.getInmateById(inmateId),
  });

  return {
    inmate: inmateQuery.data ?? null,
    isLoading: inmateQuery.isLoading,
    cellCode,
    galleryCode,
  };
}
