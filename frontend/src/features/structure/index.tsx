import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { structureApi } from './api';
import StructureFilters from './components/StructureFilters';
import GalleryCards from './components/GalleryCards';

/**
 * User Story 1 — Cadastro e Mapa da Unidade (FR-005…FR-007).
 * Unit + galleries filter up top (auto-selected on load) driving a flat
 * cells table below. Cadastro de Galeria/Cela/Unidade saiu daqui (era o
 * botão "Novo" flutuante, componente `CreateEntityDialog`) — vai virar a
 * tela de Configurações (research.md #21, tasks.md T034g/T034h). Cadastro
 * de preso continua aqui (`InmateDialog`, dentro de cada cela), pois já
 * depende do contexto de qual cela — isso não muda.
 */
export default function StructurePage(): JSX.Element {
  const { user } = useAuth();
  const isWarden = user?.role === 'WARDEN';

  const [unitId, setUnitId] = useState<number | null>(null);
  const [galleryIds, setGalleryIds] = useState<number[]>([]);

  const galleriesQuery = useQuery({
    queryKey: ['galleries', unitId],
    queryFn: () => structureApi.listGalleries(unitId as number),
    enabled: unitId !== null,
  });
  const galleries = galleriesQuery.data?.data ?? [];

  return (
    <div className="space-y-6 p-6">
      <StructureFilters
        unitId={unitId}
        onUnitChange={(id) => {
          setUnitId(id);
          setGalleryIds([]);
        }}
        onSearch={setGalleryIds}
      />

      <GalleryCards galleries={galleries} galleryIds={galleryIds} isWarden={isWarden} />
    </div>
  );
}
