import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Repeat } from 'lucide-react';
import { movementsApi } from '../../api';
import type { Movement } from '../../types';
import { structureApi } from '../../../structure/api';
import type { Gallery, Inmate } from '../../../structure/types';
import { useAuth } from '@/hooks/useAuth';
import { notify } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { cn } from '@/lib/utils';

type TransferType = 'CELL_CHANGE' | 'CELL_SWAP' | 'GALLERY_CHANGE' | 'GALLERY_SWAP';

const TRANSFER_LABEL: Record<TransferType, string> = {
  CELL_CHANGE: 'Troca de cela',
  CELL_SWAP: 'Permuta de cela',
  GALLERY_CHANGE: 'Troca de galeria',
  GALLERY_SWAP: 'Permuta de galeria',
};
const TRANSFER_DESCRIPTION: Record<TransferType, string> = {
  CELL_CHANGE: 'Move o preso para outra cela com vaga, na mesma galeria.',
  CELL_SWAP: 'Troca o preso com outro, ambos na mesma galeria — sem precisar de vaga.',
  GALLERY_CHANGE: 'Move o preso para outra galeria, numa cela com vaga.',
  GALLERY_SWAP: 'Troca o preso com outro de galeria diferente — sem precisar de vaga.',
};
const IS_SWAP: Record<TransferType, boolean> = {
  CELL_CHANGE: false,
  CELL_SWAP: true,
  GALLERY_CHANGE: false,
  GALLERY_SWAP: true,
};
const IS_CROSS_GALLERY: Record<TransferType, boolean> = {
  CELL_CHANGE: false,
  CELL_SWAP: false,
  GALLERY_CHANGE: true,
  GALLERY_SWAP: true,
};

export interface CellTransferDialogProps {
  inmate: Inmate;
  /** Galeria onde este preso está agora — define o escopo de troca/permuta de cela. */
  currentGalleryId: number;
  /** Galerias já carregadas no Mapa da Unidade — usadas pelas variações "de galeria". */
  galleries: Gallery[];
  children: ReactNode;
}

/**
 * Troca/permuta de cela e de galeria (US3, FR-015–FR-015c, research.md #35)
 * a partir de um terceiro botão na linha do preso no Mapa da Unidade —
 * seleção por cards (research.md #35 "Decision — UI", mesma linguagem do
 * mobile) em vez de abas, seguida do formulário específico do tipo
 * escolhido. Troca/permuta de galeria só aparecem pra SUPERVISOR/WARDEN — o
 * backend aplica a mesma regra via `@Roles`, isto é só a UI espelhando.
 */
export default function CellTransferDialog({
  inmate,
  currentGalleryId,
  galleries,
  children,
}: CellTransferDialogProps): JSX.Element {
  const { user } = useAuth();
  const canCrossGallery = user?.role === 'SUPERVISOR' || user?.role === 'WARDEN';
  const availableTypes = (Object.keys(TRANSFER_LABEL) as TransferType[]).filter(
    (type) => canCrossGallery || !IS_CROSS_GALLERY[type],
  );

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransferType | null>(null);
  const [destinationGalleryId, setDestinationGalleryId] = useState('');
  const [destinationCellId, setDestinationCellId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const queryClient = useQueryClient();

  const cellsGalleryId =
    type && (!IS_CROSS_GALLERY[type] || destinationGalleryId !== '')
      ? IS_CROSS_GALLERY[type]
        ? Number(destinationGalleryId)
        : currentGalleryId
      : undefined;
  const cellsQuery = useQuery({
    queryKey: ['cells', cellsGalleryId],
    queryFn: () => structureApi.listCells(cellsGalleryId as number),
    enabled: open && cellsGalleryId !== undefined,
  });
  const availableCells = (cellsQuery.data?.data ?? []).filter((cell) => {
    if (!cell.active || cell.id === inmate.currentCellId) return false;
    return type && IS_SWAP[type] ? cell.occupancy > 0 : cell.occupancy < cell.capacity;
  });

  const occupantQuery = useQuery({
    queryKey: ['cell-occupant', Number(destinationCellId)],
    queryFn: () => movementsApi.cellOccupant(Number(destinationCellId)),
    enabled: open && type !== null && IS_SWAP[type] && destinationCellId !== '',
  });

  function reset(): void {
    setType(null);
    setDestinationGalleryId('');
    setDestinationCellId('');
    setReason('');
    setNotes('');
  }

  function handleOpenChange(next: boolean): void {
    if (next) reset();
    setOpen(next);
  }

  const mutation = useMutation<Movement | Movement[]>({
    mutationFn: () => {
      const input = { inmateId: inmate.id, destinationCellId: Number(destinationCellId), reason, notes: notes || undefined };
      if (type === 'CELL_CHANGE') return movementsApi.cellChange(input);
      if (type === 'CELL_SWAP') return movementsApi.cellSwap(input);
      if (type === 'GALLERY_CHANGE') return movementsApi.galleryChange(input);
      return movementsApi.gallerySwap(input);
    },
    onSuccess: () => {
      notify({
        message: `${type ? TRANSFER_LABEL[type] : 'Situação'} de ${inmate.name} registrada`,
        type: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['inmates'] });
      void queryClient.invalidateQueries({ queryKey: ['cells'] });
      setOpen(false);
    },
    onError: () =>
      notify({
        title: `Não foi possível registrar ${type ? TRANSFER_LABEL[type].toLowerCase() : 'a troca'}`,
        message: 'Verifique os dados e tente novamente',
        type: 'error',
      }),
  });

  const canSubmit =
    type !== null &&
    destinationCellId !== '' &&
    reason.trim() !== '' &&
    (!IS_SWAP[type] || (occupantQuery.data !== undefined && occupantQuery.data !== null));

  return (
    // Mesmo motivo do wrapper em MovementDialog/FinalSituationDialog.
    <div className="contents" onClick={(e) => e.stopPropagation()}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className={type === null ? 'sm:max-w-2xl' : undefined}>
          <DialogHeader>
            <DialogTitle>
              {type === null ? `Trocar de cela — ${inmate.name}` : `${TRANSFER_LABEL[type]} — ${inmate.name}`}
            </DialogTitle>
          </DialogHeader>

          {type === null ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {availableTypes.map((value) => (
                <Card
                  key={value}
                  role="button"
                  tabIndex={0}
                  onClick={() => setType(value)}
                  className={cn(
                    'cursor-pointer transition-colors hover:border-primary hover:bg-accent',
                  )}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {IS_SWAP[value] ? (
                        <Repeat className="size-4 text-primary" />
                      ) : (
                        <ArrowLeftRight className="size-4 text-primary" />
                      )}
                      {TRANSFER_LABEL[value]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <CardDescription>{TRANSFER_DESCRIPTION[value]}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4">
                {IS_CROSS_GALLERY[type] && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="transfer-gallery">Galeria de destino</Label>
                    <Select
                      value={destinationGalleryId}
                      onValueChange={(value) => {
                        setDestinationGalleryId(value);
                        setDestinationCellId('');
                      }}
                    >
                      <SelectTrigger id="transfer-gallery">
                        <SelectValue placeholder="Selecione a galeria" />
                      </SelectTrigger>
                      <SelectContent>
                        {galleries
                          .filter((gallery) => gallery.id !== currentGalleryId)
                          .map((gallery) => (
                            <SelectItem key={gallery.id} value={String(gallery.id)}>
                              Galeria {gallery.code}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid gap-1.5">
                  <Label htmlFor="transfer-cell">Cela de destino</Label>
                  <Select
                    value={destinationCellId}
                    onValueChange={setDestinationCellId}
                    disabled={IS_CROSS_GALLERY[type] && destinationGalleryId === ''}
                  >
                    <SelectTrigger id="transfer-cell">
                      <SelectValue placeholder="Selecione a cela" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCells.map((cell) => (
                        <SelectItem key={cell.id} value={String(cell.id)}>
                          Cela {cell.code} ({cell.occupancy}/{cell.capacity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {IS_SWAP[type] && destinationCellId !== '' && (
                    <p className="text-xs text-muted-foreground">
                      {occupantQuery.isLoading
                        ? 'Consultando ocupante...'
                        : occupantQuery.data
                          ? `Trocará de cela com: ${occupantQuery.data.name}`
                          : 'Essa cela não está mais ocupada — escolha outra.'}
                    </p>
                  )}
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="transfer-reason">Motivo</Label>
                  <Input id="transfer-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="transfer-notes">Observações</Label>
                  <Input id="transfer-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="outline" onClick={reset}>
                  Voltar
                </Button>
                <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
                  {mutation.isPending ? 'Salvando...' : 'Confirmar'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
