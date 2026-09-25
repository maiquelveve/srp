import { useState, type ReactNode } from 'react';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { movementsApi } from '../../api';
import InmateHeaderCard from '../InmateHeaderCard';
import { structureApi } from '../../../structure/api';
import type { Gallery, Inmate } from '../../../structure/types';
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

export interface ReversalDialogProps {
  inmate: Pick<Inmate, 'id' | 'name' | 'registrationId'>;
  /** Galerias da unidade: a cela de destino pode ser de qualquer uma delas. */
  galleries: Gallery[];
  children: ReactNode;
}

/**
 * Reverte uma liberdade, tornozeleira ou transferência registrada por engano
 * (FR-016a, WARDEN only). O registro original não é apagado: o backend cria
 * uma nova movimentação e o preso volta a ativo na cela escolhida, que
 * precisa ter vaga.
 */
export default function ReversalDialog({ inmate, galleries, children }: ReversalDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [galleryId, setGalleryId] = useState('');
  const [cellId, setCellId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const queryClient = useQueryClient();

  function handleOpenChange(next: boolean): void {
    if (next) {
      setGalleryId('');
      setCellId('');
      setReason('');
      setNotes('');
    }
    setOpen(next);
  }

  // Uma consulta por galeria (mesma queryKey ['cells', id] do Mapa da Unidade, então
  // normalmente já está em cache). Só entram no seletor as galerias que têm ao menos
  // uma cela ativa com vaga: não há como mandar o preso para uma galeria lotada.
  const cellsQueries = useQueries({
    queries: galleries.map((gallery) => ({
      queryKey: ['cells', gallery.id],
      queryFn: () => structureApi.listCells(gallery.id),
      enabled: open,
    })),
  });
  const cellsWithVacancyByGalleryId = new Map(
    galleries.map((gallery, index) => [
      gallery.id,
      (cellsQueries[index]?.data?.data ?? []).filter((cell) => cell.active && cell.occupancy < cell.capacity),
    ]),
  );
  const galleriesWithVacancy = galleries.filter(
    (gallery) => (cellsWithVacancyByGalleryId.get(gallery.id)?.length ?? 0) > 0,
  );
  const cellsLoading = cellsQueries.some((query) => query.isLoading);
  const cellsWithVacancy = cellsWithVacancyByGalleryId.get(Number(galleryId)) ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      movementsApi.finalReversal({
        inmateId: inmate.id,
        destinationCellId: Number(cellId),
        reason,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      notify({ message: `Situação de ${inmate.name.toUpperCase()} revertida. Preso ativo novamente`, type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['inmates'] });
      void queryClient.invalidateQueries({ queryKey: ['definitive-situations'] });
      void queryClient.invalidateQueries({ queryKey: ['cells'] });
      setOpen(false);
    },
    onError: () =>
      notify({
        title: 'Não foi possível reverter a situação',
        message: 'Verifique se a cela ainda tem vaga e tente novamente',
        type: 'error',
      }),
  });

  const canSubmit = cellId !== '' && reason.trim() !== '';

  return (
    <div className="contents" onClick={(e) => e.stopPropagation()}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverter situação</DialogTitle>
          </DialogHeader>

          <InmateHeaderCard name={inmate.name} registrationId={inmate.registrationId} />

          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Use quando a liberdade, a tornozeleira ou a transferência foi registrada por engano. O registro
              original continua no histórico.
            </p>

            <div className="grid gap-1.5">
              <Label htmlFor="reversal-gallery">Galeria de destino</Label>
              <Select
                value={galleryId}
                onValueChange={(value) => {
                  setGalleryId(value);
                  setCellId('');
                }}
              >
                <SelectTrigger id="reversal-gallery">
                  <SelectValue placeholder="Selecione a galeria" />
                </SelectTrigger>
                <SelectContent>
                  {galleriesWithVacancy.map((gallery) => (
                    <SelectItem key={gallery.id} value={String(gallery.id)}>
                      Galeria {gallery.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!cellsLoading && galleriesWithVacancy.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma galeria da unidade tem cela com vaga.</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="reversal-cell">Cela de destino</Label>
              <Select value={cellId} onValueChange={setCellId} disabled={galleryId === ''}>
                <SelectTrigger id="reversal-cell">
                  <SelectValue placeholder="Selecione a cela" />
                </SelectTrigger>
                <SelectContent>
                  {cellsWithVacancy.map((cell) => (
                    <SelectItem key={cell.id} value={String(cell.id)}>
                      Cela {cell.code} ({cell.capacity - cell.occupancy} vaga(s))
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="reversal-reason">Motivo da reversão</Label>
              <Input id="reversal-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="reversal-notes">Observações (opcional)</Label>
              <Input id="reversal-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
