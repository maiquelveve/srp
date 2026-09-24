import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { structureApi } from '@/features/structure/api';

/** Unidade selecionada (a primeira do escopo do usuário por padrão; `GET /units` já é filtrado, FR-004a). */
export function useSelectedUnit() {
  const [unitId, setUnitId] = useState<number | null>(null);
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: structureApi.listUnits });

  useEffect(() => {
    const units = unitsQuery.data?.data ?? [];
    if (units.length === 0) return;
    if (unitId === null || !units.some((unit) => unit.id === unitId)) {
      setUnitId(units[0].id);
    }
  }, [unitId, unitsQuery.data]);

  return { unitId, setUnitId, units: unitsQuery.data?.data ?? [] };
}
