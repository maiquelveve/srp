import { useState } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import { structureApi } from '../../api';
import type { Gallery } from '../../types';
import { notify } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type EntityType = 'gallery' | 'cell' | 'inmate';

const ENTITY_LABEL: Record<EntityType, string> = {
  gallery: 'Galeria',
  cell: 'Cela',
  inmate: 'Preso',
};

export interface CreateEntityDialogProps {
  unitId: number;
  galleries: Gallery[];
}

/**
 * WARDEN-only "Novo" button (the caller is responsible for the role check —
 * this component has no opinion on who renders it) opening a dialog that
 * creates a Gallery, Cell, or Inmate depending on a type selector, reusing
 * the same mutations `StructurePage`'s drill-down used to own directly.
 */
export default function CreateEntityDialog({ unitId, galleries }: CreateEntityDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [entityType, setEntityType] = useState<EntityType>('gallery');
  const [galleryCode, setGalleryCode] = useState('');
  const [cellGalleryId, setCellGalleryId] = useState<number | null>(null);
  const [cellCode, setCellCode] = useState('');
  const [cellCapacity, setCellCapacity] = useState(1);
  const [inmateCellId, setInmateCellId] = useState<number | null>(null);
  const [inmateName, setInmateName] = useState('');

  const queryClient = useQueryClient();

  const cellsByGalleryQuery = useQueries({
    queries: galleries.map((gallery) => ({
      queryKey: ['cells', gallery.id],
      queryFn: () => structureApi.listCells(gallery.id),
      enabled: open && entityType === 'inmate',
    })),
  });
  const allCells = cellsByGalleryQuery.flatMap((q, i) =>
    (q.data?.data ?? []).map((cell) => ({ ...cell, galleryCode: galleries[i].code })),
  );

  function resetForm(): void {
    setGalleryCode('');
    setCellGalleryId(null);
    setCellCode('');
    setCellCapacity(1);
    setInmateCellId(null);
    setInmateName('');
  }

  const createGallery = useMutation({
    mutationFn: () => structureApi.createGallery({ unitId, code: galleryCode }),
    onSuccess: () => {
      notify({ message: `Galeria ${galleryCode} cadastrada`, type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['galleries', unitId] });
      resetForm();
      setOpen(false);
    },
    onError: () => notify({ title: 'Não foi possível cadastrar', message: 'Tente novamente', type: 'error' }),
  });

  const createCell = useMutation({
    mutationFn: () =>
      structureApi.createCell({ galleryId: cellGalleryId as number, code: cellCode, capacity: cellCapacity }),
    onSuccess: () => {
      notify({ message: `Cela ${cellCode} cadastrada`, type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['cells', cellGalleryId] });
      resetForm();
      setOpen(false);
    },
    onError: () => notify({ title: 'Não foi possível cadastrar', message: 'Verifique os dados', type: 'error' }),
  });

  const createInmate = useMutation({
    mutationFn: () => structureApi.createInmate({ name: inmateName, currentCellId: inmateCellId as number }),
    onSuccess: () => {
      notify({ message: `${inmateName} cadastrado`, type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['inmates', inmateCellId] });
      void queryClient.invalidateQueries({ queryKey: ['cells'] });
      resetForm();
      setOpen(false);
    },
    onError: () =>
      notify({ title: 'Não foi possível cadastrar', message: 'Verifique a capacidade da cela', type: 'error' }),
  });

  const isPending = createGallery.isPending || createCell.isPending || createInmate.isPending;

  function handleSubmit(): void {
    if (entityType === 'gallery') createGallery.mutate();
    else if (entityType === 'cell') createCell.mutate();
    else createInmate.mutate();
  }

  const canSubmit =
    entityType === 'gallery'
      ? galleryCode.length > 0
      : entityType === 'cell'
        ? cellGalleryId !== null && cellCode.length > 0
        : inmateCellId !== null && inmateName.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {/* Deep, strong green — a deliberate one-off exception to the muted
            --success token, per direct request for a darker, stronger green. */}
        <Button className="fixed bottom-6 right-6 z-40 h-14 gap-2 rounded-full bg-[#15803D] px-6 text-base font-bold text-white shadow-lg hover:bg-[#166534]">
          <PlusIcon className="size-5" strokeWidth={3} />
          Novo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar {ENTITY_LABEL[entityType]}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={entityType} onValueChange={(v) => setEntityType(v as EntityType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gallery">Galeria</SelectItem>
                <SelectItem value="cell">Cela</SelectItem>
                <SelectItem value="inmate">Preso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {entityType === 'gallery' && (
            <div className="grid gap-1.5">
              <Label htmlFor="gallery-code">Código da galeria</Label>
              <Input id="gallery-code" value={galleryCode} onChange={(e) => setGalleryCode(e.target.value)} />
            </div>
          )}

          {entityType === 'cell' && (
            <>
              <div className="grid gap-1.5">
                <Label>Galeria</Label>
                <Select
                  value={cellGalleryId !== null ? String(cellGalleryId) : ''}
                  onValueChange={(v) => setCellGalleryId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a galeria" />
                  </SelectTrigger>
                  <SelectContent>
                    {galleries.map((gallery) => (
                      <SelectItem key={gallery.id} value={String(gallery.id)}>
                        Galeria {gallery.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cell-code">Código da cela</Label>
                <Input id="cell-code" value={cellCode} onChange={(e) => setCellCode(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="cell-capacity">Capacidade</Label>
                <Input
                  id="cell-capacity"
                  type="number"
                  min={0}
                  value={cellCapacity}
                  onChange={(e) => setCellCapacity(Number(e.target.value))}
                />
              </div>
            </>
          )}

          {entityType === 'inmate' && (
            <>
              <div className="grid gap-1.5">
                <Label>Cela</Label>
                <Select
                  value={inmateCellId !== null ? String(inmateCellId) : ''}
                  onValueChange={(v) => setInmateCellId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a cela" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCells.map((cell) => (
                      <SelectItem key={cell.id} value={String(cell.id)}>
                        Galeria {cell.galleryCode} - Cela {cell.code} ({cell.occupancy}/{cell.capacity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="inmate-name">Nome do preso</Label>
                <Input id="inmate-name" value={inmateName} onChange={(e) => setInmateName(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
