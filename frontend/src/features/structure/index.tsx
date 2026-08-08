import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { structureApi } from './api';
import CreateEntityDialog from './components/CreateEntityDialog';
import StructureFilters from './components/StructureFilters';
import GalleryCards from './components/GalleryCards';

/**
 * User Story 1 — Cadastro e Mapa da Unidade (FR-005…FR-007).
 * Unit + galleries filter up top (auto-selected on load) driving a flat
 * cells table below; creation (gallery/cell/inmate) is gated to WARDEN
 * behind a single "Novo" dialog — backend is the real enforcement point
 * (FR-004/FR-004a), this hiding is just UX, not a security boundary.
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

      {isWarden && unitId !== null && <CreateEntityDialog unitId={unitId} galleries={galleries} />}
    </div>
  );
}
