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
// Remembers the last unit picked here across reloads (F5 was resetting back
// to the first unit in the list every time) — same simple localStorage-cache
// approach as `/configuracoes` (`SettingsPage`'s `SETTINGS_UNIT_STORAGE_KEY`),
// kept as a separate key since the two screens don't need to share a
// selection.
const STRUCTURE_UNIT_STORAGE_KEY = 'srp:structure:lastUnitId';

export default function StructurePage(): JSX.Element {
  const { user } = useAuth();
  const isWarden = user?.role === 'WARDEN';

  const [unitId, setUnitId] = useState<number | null>(() => {
    const stored = localStorage.getItem(STRUCTURE_UNIT_STORAGE_KEY);
    return stored ? Number(stored) : null;
  });
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
          localStorage.setItem(STRUCTURE_UNIT_STORAGE_KEY, String(id));
          setGalleryIds([]);
        }}
        onSearch={setGalleryIds}
      />

      <GalleryCards galleries={galleries} galleryIds={galleryIds} isWarden={isWarden} />
    </div>
  );
}
