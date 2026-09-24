import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { structureApi } from '@/features/structure/api';
import { staffApi } from '../api';

/**
 * Unidade selecionada (primeira do escopo do usuário por padrão) e os postos
 * de serviço dela. Por padrão só os ativos, que são os que podem receber
 * escalas; a tela de gestão de postos pede também os inativos.
 */
export function useUnitPosts(options: { includeInactive?: boolean } = {}) {
  const includeInactive = options.includeInactive ?? false;
  const [unitId, setUnitId] = useState<number | null>(null);

  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: structureApi.listUnits });
  const postsQuery = useQuery({
    queryKey: ['posts', unitId, includeInactive],
    queryFn: () => staffApi.listPosts({ unitId: unitId as number, includeInactive }),
    enabled: unitId !== null,
  });

  useEffect(() => {
    if (!unitsQuery.data || unitsQuery.data.data.length === 0) return;
    const stillValid = unitId !== null && unitsQuery.data.data.some((unit) => unit.id === unitId);
    if (!stillValid) {
      setUnitId(unitsQuery.data.data[0].id);
    }
  }, [unitId, unitsQuery.data]);

  return {
    unitId,
    setUnitId,
    units: unitsQuery.data?.data ?? [],
    posts: postsQuery.data?.data ?? [],
    isLoadingPosts: unitId === null || postsQuery.isLoading,
  };
}
