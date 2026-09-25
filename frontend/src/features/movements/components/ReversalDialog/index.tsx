import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User } from 'lucide-react';
import { movementsApi } from '../../api';
import { structureApi } from '../../../structure/api';
import type { Gallery, Inmate } from '../../../structure/types';
import { notify } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ReversalDialogProps {
  inmate: Inmate;
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

  const cellsQuery = useQuery({
    queryKey: ['cells', Number(galleryId)],
    queryFn: () => structureApi.listCells(Number(galleryId)),
    enabled: open && galleryId !== '',
  });
  const cellsWithVacancy = (cellsQuery.data?.data ?? []).filter(
    (cell) => cell.active && cell.occupancy < cell.capacity,
  );

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
            <DialogDescription className="flex items-center gap-1.5 uppercase">
              <User className="size-3.5" />
              {inmate.name}
            </DialogDescription>
          </DialogHeader>

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
                  {galleries.map((gallery) => (
                    <SelectItem key={gallery.id} value={String(gallery.id)}>
                      Galeria {gallery.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {galleryId !== '' && !cellsQuery.isLoading && cellsWithVacancy.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma cela com vaga nesta galeria.</p>
              )}
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
