import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SearchIcon } from 'lucide-react';
import { structureApi } from '../../api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface StructureFiltersProps {
  unitId: number | null;
  onUnitChange: (unitId: number) => void;
  onSearch: (galleryIds: number[]) => void;
}

/**
 * Unit select (auto-picks the logged-in user's first accessible unit —
 * `GET /units` is already scoped server-side per FR-004a, so "all units
 * returned" IS "all units this user can see") + galleries multi-select,
 * all pre-selected and auto-searched on load/unit change. "Pesquisar"
 * commits the gallery checkboxes (draft) into the applied filter.
 */
export default function StructureFilters({ unitId, onUnitChange, onSearch }: StructureFiltersProps): JSX.Element {
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: structureApi.listUnits });
  const galleriesQuery = useQuery({
    queryKey: ['galleries', unitId],
    queryFn: () => structureApi.listGalleries(unitId as number),
    enabled: unitId !== null,
  });

  const [draftGalleryIds, setDraftGalleryIds] = useState<number[]>([]);

  // Auto-select the user's first accessible unit once the list loads.
  useEffect(() => {
    if (unitId === null && unitsQuery.data && unitsQuery.data.data.length > 0) {
      onUnitChange(unitsQuery.data.data[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitId, unitsQuery.data]);

  // Whenever the gallery list changes (unit switched), select all of them
  // and auto-run the search immediately — no manual click needed on load.
  useEffect(() => {
    if (galleriesQuery.data) {
      const allIds = galleriesQuery.data.data.map((g) => g.id);
      setDraftGalleryIds(allIds);
      onSearch(allIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleriesQuery.data]);

  const galleries = galleriesQuery.data?.data ?? [];
  const selectedGalleryNames = galleries
    .filter((gallery) => draftGalleryIds.includes(gallery.id))
    .map((gallery) => `Galeria ${gallery.code}`)
    .join(', ');
  const galleryLabel =
    draftGalleryIds.length === 0
      ? 'Nenhuma galeria'
      : draftGalleryIds.length === galleries.length
        ? 'Todas as galerias'
        : selectedGalleryNames;

  function toggleGallery(id: number, checked: boolean): void {
    setDraftGalleryIds((prev) => (checked ? [...prev, id] : prev.filter((g) => g !== id)));
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
      <div className="grid gap-1.5">
        <span className="text-sm font-medium text-foreground">Unidade</span>
        <Select
          value={unitId !== null ? String(unitId) : ''}
          onValueChange={(value) => onUnitChange(Number(value))}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Selecione a unidade" />
          </SelectTrigger>
          <SelectContent>
            {unitsQuery.data?.data.map((unit) => (
              <SelectItem key={unit.id} value={String(unit.id)}>
                {unit.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <span className="text-sm font-medium text-foreground">Galerias</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-56 justify-start truncate font-normal" title={galleryLabel}>
              {galleryLabel}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            {galleries.map((gallery) => (
              <DropdownMenuCheckboxItem
                key={gallery.id}
                checked={draftGalleryIds.includes(gallery.id)}
                onCheckedChange={(checked) => toggleGallery(gallery.id, checked)}
                onSelect={(e) => e.preventDefault()}
              >
                Galeria {gallery.code}
              </DropdownMenuCheckboxItem>
            ))}
            {galleries.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">Nenhuma galeria cadastrada</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-1.5">
        <span className="invisible text-sm font-medium">Pesquisar</span>
        <Button
          variant="outline"
          className="border-primary bg-accent px-6 font-bold text-accent-foreground hover:scale-105"
          onClick={() => onSearch(draftGalleryIds)}
        >
          <SearchIcon />
          Pesquisar
        </Button>
      </div>
    </div>
  );
}
