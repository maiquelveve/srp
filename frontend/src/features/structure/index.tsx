import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { structureApi } from './api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import StatusBadge from './components/StatusBadge';

/**
 * User Story 1 — Cadastro e Mapa da Unidade (FR-005…FR-007).
 * Drill-down: Units -> Galleries -> Cells -> Inmates, with creation forms
 * gated to WARDEN (backend is the real enforcement point — FR-004/FR-004a —
 * this hiding is just UX, not a security boundary).
 */
export default function StructurePage(): JSX.Element {
  const { user } = useAuth();
  const isWarden = user?.role === 'WARDEN';

  const [unitId, setUnitId] = useState<number | null>(null);
  const [galleryId, setGalleryId] = useState<number | null>(null);
  const [cellId, setCellId] = useState<number | null>(null);

  const queryClient = useQueryClient();

  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: structureApi.listUnits });
  const galleriesQuery = useQuery({
    queryKey: ['galleries', unitId],
    queryFn: () => structureApi.listGalleries(unitId as number),
    enabled: unitId !== null,
  });
  const cellsQuery = useQuery({
    queryKey: ['cells', galleryId],
    queryFn: () => structureApi.listCells(galleryId as number),
    enabled: galleryId !== null,
  });
  const inmatesQuery = useQuery({
    queryKey: ['inmates', cellId],
    queryFn: () => structureApi.listInmates({ cellId: cellId as number }),
    enabled: cellId !== null,
  });

  const [newGalleryCode, setNewGalleryCode] = useState('');
  const createGallery = useMutation({
    mutationFn: () => structureApi.createGallery({ unitId: unitId as number, code: newGalleryCode }),
    onSuccess: () => {
      setNewGalleryCode('');
      void queryClient.invalidateQueries({ queryKey: ['galleries', unitId] });
    },
  });

  const [newCellCode, setNewCellCode] = useState('');
  const [newCellCapacity, setNewCellCapacity] = useState(1);
  const createCell = useMutation({
    mutationFn: () =>
      structureApi.createCell({
        galleryId: galleryId as number,
        code: newCellCode,
        capacity: newCellCapacity,
      }),
    onSuccess: () => {
      setNewCellCode('');
      void queryClient.invalidateQueries({ queryKey: ['cells', galleryId] });
    },
  });

  const [newInmateName, setNewInmateName] = useState('');
  const createInmate = useMutation({
    mutationFn: () =>
      structureApi.createInmate({ name: newInmateName, currentCellId: cellId as number }),
    onSuccess: () => {
      setNewInmateName('');
      void queryClient.invalidateQueries({ queryKey: ['inmates', cellId] });
      void queryClient.invalidateQueries({ queryKey: ['cells', galleryId] });
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <section>
        <h2 className="mb-2 font-medium text-foreground">Unidades</h2>
        <ul className="flex flex-wrap gap-2">
          {unitsQuery.data?.data.map((unit) => (
            <li key={unit.id}>
              <Button
                variant={unitId === unit.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setUnitId(unit.id);
                  setGalleryId(null);
                  setCellId(null);
                }}
              >
                {unit.name}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      {unitId !== null && (
        <section>
          <h2 className="mb-2 font-medium text-foreground">Galerias</h2>
          <ul className="flex flex-wrap gap-2">
            {galleriesQuery.data?.data.map((gallery) => (
              <li key={gallery.id}>
                <Button
                  variant={galleryId === gallery.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setGalleryId(gallery.id);
                    setCellId(null);
                  }}
                >
                  {gallery.code}
                </Button>
              </li>
            ))}
          </ul>
          {isWarden && (
            <div className="mt-3 flex gap-2">
              <Input
                value={newGalleryCode}
                onChange={(e) => setNewGalleryCode(e.target.value)}
                placeholder="Código da nova galeria"
                className="max-w-xs"
              />
              <Button
                onClick={() => createGallery.mutate()}
                disabled={!newGalleryCode || createGallery.isPending}
              >
                Adicionar galeria
              </Button>
            </div>
          )}
        </section>
      )}

      {galleryId !== null && (
        <section>
          <h2 className="mb-2 font-medium text-foreground">Celas</h2>
          <ul className="flex flex-wrap gap-2">
            {cellsQuery.data?.data.map((cell) => (
              <li key={cell.id}>
                <Button
                  variant={cellId === cell.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCellId(cell.id)}
                >
                  {cell.code}{' '}
                  <span
                    className={cn(
                      'ml-1 font-semibold',
                      cell.occupancy >= cell.capacity ? 'text-warning' : 'text-success',
                    )}
                  >
                    ({cell.occupancy}/{cell.capacity})
                  </span>
                </Button>
              </li>
            ))}
          </ul>
          {isWarden && (
            <div className="mt-3 flex gap-2">
              <Input
                value={newCellCode}
                onChange={(e) => setNewCellCode(e.target.value)}
                placeholder="Código da nova cela"
                className="max-w-xs"
              />
              <Input
                type="number"
                min={0}
                value={newCellCapacity}
                onChange={(e) => setNewCellCapacity(Number(e.target.value))}
                className="w-24"
              />
              <Button
                onClick={() => createCell.mutate()}
                disabled={!newCellCode || createCell.isPending}
              >
                Adicionar cela
              </Button>
            </div>
          )}
        </section>
      )}

      {cellId !== null && (
        <section>
          <h2 className="mb-2 font-medium text-foreground">Presos na cela</h2>
          <ul className="space-y-1">
            {inmatesQuery.data?.data.map((inmate) => (
              <li
                key={inmate.id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-card-foreground"
              >
                <span>{inmate.name}</span>
                <span className="flex items-center gap-2 text-sm">
                  <StatusBadge status={inmate.status} />
                  {inmate.inMovement && <span className="text-warning">fora da cela</span>}
                </span>
              </li>
            ))}
            {inmatesQuery.data?.data.length === 0 && (
              <li className="text-muted-foreground">Nenhum preso nesta cela.</li>
            )}
          </ul>
          {isWarden && (
            <div className="mt-3 flex items-center gap-2">
              <Input
                value={newInmateName}
                onChange={(e) => setNewInmateName(e.target.value)}
                placeholder="Nome do preso"
                className="max-w-xs"
              />
              <Button
                onClick={() => createInmate.mutate()}
                disabled={!newInmateName || createInmate.isPending}
              >
                Cadastrar preso
              </Button>
              {createInmate.isError && (
                <span className="text-sm text-destructive">
                  Não foi possível cadastrar (capacidade?)
                </span>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
