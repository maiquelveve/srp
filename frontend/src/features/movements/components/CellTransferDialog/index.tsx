import { useState, type ReactNode } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Check, ChevronsUpDown, Repeat } from 'lucide-react';
import { movementsApi } from '../../api';
import InmateHeaderCard from '../InmateHeaderCard';
import type { Movement } from '../../types';
import { structureApi } from '../../../structure/api';
import type { Gallery, Inmate } from '../../../structure/types';
import { useAuth } from '@/hooks/useAuth';
import { notify } from '@/lib/notify';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  CELL_SWAP: 'Troca o preso com outro, ambos na mesma galeria. Não precisa de vaga.',
  GALLERY_CHANGE: 'Move o preso para outra galeria, numa cela com vaga.',
  GALLERY_SWAP: 'Troca o preso com outro de galeria diferente. Não precisa de vaga.',
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
const UNAVAILABLE_REASON: Record<TransferType, string> = {
  CELL_CHANGE: 'Nenhuma cela com vaga nesta galeria no momento.',
  CELL_SWAP: 'Nenhuma outra cela ocupada nesta galeria no momento.',
  GALLERY_CHANGE: 'Nenhuma cela com vaga em outra galeria no momento.',
  GALLERY_SWAP: 'Nenhuma cela ocupada em outra galeria no momento.',
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
  const [selectedDestinationInmateId, setSelectedDestinationInmateId] = useState('');
  const [destinationInmateComboOpen, setDestinationInmateComboOpen] = useState(false);
  const [destinationInmateSearch, setDestinationInmateSearch] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const queryClient = useQueryClient();

  // Disponibilidade de destino por tipo, checada assim que o diálogo abre —
  // ainda na tela de seleção de card, antes do usuário escolher um tipo —
  // pra não deixar ele entrar num formulário cujo select de cela some vazio
  // sem explicação (parece bug). Reaproveita a mesma queryKey ['cells', id]
  // que GalleryCard já usa pra listar celas da galeria, então a galeria atual
  // (já expandida na tela) normalmente já está em cache.
  const homeCellsQuery = useQuery({
    queryKey: ['cells', currentGalleryId],
    queryFn: () => structureApi.listCells(currentGalleryId),
    enabled: open,
  });
  const homeCells = (homeCellsQuery.data?.data ?? []).filter(
    (cell) => cell.active && cell.id !== inmate.currentCellId,
  );
  const cellChangeAvailable = homeCells.some((cell) => cell.occupancy < cell.capacity);
  const cellSwapAvailable = homeCells.some((cell) => cell.occupancy > 0);

  const otherGalleries = galleries.filter((gallery) => gallery.id !== currentGalleryId);
  const otherGalleryCellsQueries = useQueries({
    queries: canCrossGallery
      ? otherGalleries.map((gallery) => ({
          queryKey: ['cells', gallery.id],
          queryFn: () => structureApi.listCells(gallery.id),
          enabled: open,
        }))
      : [],
  });
  const otherGalleryCellsChecking = canCrossGallery && otherGalleryCellsQueries.some((query) => query.isLoading);
  // Por galeria (não achatado) — usado tanto pra saber se ALGUMA galeria
  // serve de destino (cards) quanto pra filtrar QUAIS galerias aparecem no
  // select (não faz sentido listar uma galeria sem cela elegível, o usuário
  // só ia escolher e trombar com um segundo select vazio).
  const activeCellsByGalleryId = new Map(
    otherGalleries.map((gallery, i) => [
      gallery.id,
      (otherGalleryCellsQueries[i]?.data?.data ?? []).filter((cell) => cell.active),
    ]),
  );
  const otherGalleryCells = [...activeCellsByGalleryId.values()].flat();
  const galleryChangeAvailable = otherGalleryCells.some((cell) => cell.occupancy < cell.capacity);
  const gallerySwapAvailable = otherGalleryCells.some((cell) => cell.occupancy > 0);

  const TYPE_AVAILABILITY: Record<TransferType, { checking: boolean; available: boolean }> = {
    CELL_CHANGE: { checking: homeCellsQuery.isLoading, available: cellChangeAvailable },
    CELL_SWAP: { checking: homeCellsQuery.isLoading, available: cellSwapAvailable },
    GALLERY_CHANGE: { checking: otherGalleryCellsChecking, available: galleryChangeAvailable },
    GALLERY_SWAP: { checking: otherGalleryCellsChecking, available: gallerySwapAvailable },
  };

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

  // Permuta troca com um preso específico, não "a cela" — uma cela
  // compartilhada pode ter mais de um ocupante ativo, então não dá pra
  // assumir "quem estiver lá". Lista todos os ocupantes ativos (mesma
  // listagem que o Mapa da Unidade já usa) e deixa o usuário escolher
  // (research.md #36 — bug relatado pelo usuário: antes vinha um preso
  // pré-selecionado sem escolha possível).
  const destinationCandidatesQuery = useQuery({
    queryKey: ['inmates', Number(destinationCellId)],
    queryFn: () => structureApi.listInmates({ cellId: Number(destinationCellId), status: 'ACTIVE' }),
    enabled: open && type !== null && IS_SWAP[type] && destinationCellId !== '',
  });
  const destinationCandidates = destinationCandidatesQuery.data?.data ?? [];
  // Busca por substring simples (não a fuzzy-match padrão do cmdk, que
  // "encontra" nomes sem relação nenhuma — ex.: "vini" batendo em "Otavio
  // Teixeira Martins" por casar as letras em qualquer ordem/posição, bug
  // relatado pelo usuário). `shouldFilter={false}` no Command abaixo
  // desliga o filtro embutido; filtramos nós mesmos aqui.
  const normalizedSearch = destinationInmateSearch.trim().toLowerCase();
  const filteredDestinationCandidates =
    normalizedSearch === ''
      ? destinationCandidates
      : destinationCandidates.filter((candidate) =>
          candidate.name.toLowerCase().includes(normalizedSearch),
        );
  // Só pré-seleciona quando não há ambiguidade (um único ocupante) — é
  // exatamente o caso comum, sem custar a escolha explícita quando há 2+.
  const destinationInmateId =
    selectedDestinationInmateId !== ''
      ? selectedDestinationInmateId
      : destinationCandidates.length === 1
        ? String(destinationCandidates[0].id)
        : '';
  const selectedDestinationCandidate = destinationCandidates.find(
    (candidate) => String(candidate.id) === destinationInmateId,
  );

  function reset(): void {
    setType(null);
    setDestinationGalleryId('');
    setDestinationCellId('');
    setSelectedDestinationInmateId('');
    setDestinationInmateSearch('');
    setReason('');
    setNotes('');
  }

  function handleOpenChange(next: boolean): void {
    if (next) reset();
    setOpen(next);
  }

  const mutation = useMutation<Movement | Movement[]>({
    mutationFn: () => {
      const input = {
        inmateId: inmate.id,
        destinationCellId: Number(destinationCellId),
        ...(type && IS_SWAP[type] ? { destinationInmateId: Number(destinationInmateId) } : {}),
        reason,
        notes: notes || undefined,
      };
      if (type === 'CELL_CHANGE') return movementsApi.cellChange(input);
      if (type === 'CELL_SWAP') return movementsApi.cellSwap(input);
      if (type === 'GALLERY_CHANGE') return movementsApi.galleryChange(input);
      return movementsApi.gallerySwap(input);
    },
    onSuccess: () => {
      notify({
        message: `${type ? TRANSFER_LABEL[type] : 'Situação'} de ${inmate.name.toUpperCase()} registrada`,
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
    (!IS_SWAP[type] ||
      (destinationInmateId !== '' &&
        selectedDestinationCandidate !== undefined &&
        !selectedDestinationCandidate.inMovement));

  return (
    // Mesmo motivo do wrapper em MovementDialog/FinalSituationDialog.
    <div className="contents" onClick={(e) => e.stopPropagation()}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent className={type === null ? 'sm:max-w-2xl' : undefined}>
          <DialogHeader>
            <DialogTitle>{type === null ? 'Trocar de cela' : TRANSFER_LABEL[type]}</DialogTitle>
          </DialogHeader>

          <InmateHeaderCard name={inmate.name} registrationId={inmate.registrationId} />

          {type === null ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {availableTypes.map((value) => {
                const { checking, available } = TYPE_AVAILABILITY[value];
                const disabled = checking || !available;
                const card = (
                  <Card
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    aria-disabled={disabled}
                    onClick={() => {
                      if (!disabled) setType(value);
                    }}
                    className={cn(
                      'transition-colors',
                      disabled
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer hover:border-primary hover:bg-accent',
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
                        {disabled && (
                          <Badge
                            variant={checking ? 'outline' : 'destructive'}
                            className={cn('ml-auto font-normal', checking && 'text-muted-foreground')}
                          >
                            {checking ? 'Verificando...' : 'Indisponível'}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <CardDescription>{TRANSFER_DESCRIPTION[value]}</CardDescription>
                    </CardContent>
                  </Card>
                );

                if (!disabled) return <div key={value}>{card}</div>;

                return (
                  <Tooltip key={value}>
                    <TooltipTrigger asChild>{card}</TooltipTrigger>
                    <TooltipContent>
                      {checking ? 'Verificando disponibilidade...' : UNAVAILABLE_REASON[value]}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
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
                        {otherGalleries
                          .filter((gallery) => {
                            const cells = activeCellsByGalleryId.get(gallery.id) ?? [];
                            return cells.some((cell) =>
                              IS_SWAP[type] ? cell.occupancy > 0 : cell.occupancy < cell.capacity,
                            );
                          })
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
                    onValueChange={(value) => {
                      setDestinationCellId(value);
                      setSelectedDestinationInmateId('');
                      setDestinationInmateSearch('');
                    }}
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
                </div>

                {IS_SWAP[type] && destinationCellId !== '' && (
                  <div className="grid gap-1.5">
                    <Label htmlFor="transfer-inmate">Preso de destino</Label>
                    {destinationCandidatesQuery.isLoading ? (
                      <p className="text-xs text-muted-foreground">Consultando ocupantes...</p>
                    ) : destinationCandidates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Essa cela não está mais ocupada. Escolha outra.
                      </p>
                    ) : (
                      <>
                        {/* Combobox com busca (Popover + Command/cmdk) em vez
                            de Select puro — cela compartilhada pode ter
                            muitos ocupantes, e rolar uma lista fechada pra
                            achar um nome é pior do que digitar pra filtrar. */}
                        <Popover open={destinationInmateComboOpen} onOpenChange={setDestinationInmateComboOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              id="transfer-inmate"
                              type="button"
                              variant="outline"
                              role="combobox"
                              aria-expanded={destinationInmateComboOpen}
                              className="w-full justify-between font-normal"
                            >
                              <span className={cn('truncate', selectedDestinationCandidate && 'uppercase')}>
                                {selectedDestinationCandidate?.name ?? 'Selecione o preso'}
                              </span>
                              <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[--radix-popover-trigger-width] p-0"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                          >
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Buscar preso..."
                                value={destinationInmateSearch}
                                onValueChange={setDestinationInmateSearch}
                              />
                              <CommandList>
                                <CommandEmpty>Nenhum preso encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {filteredDestinationCandidates.map((candidate) => (
                                    <CommandItem
                                      key={candidate.id}
                                      value={candidate.name}
                                      onSelect={() => {
                                        setSelectedDestinationInmateId(String(candidate.id));
                                        setDestinationInmateComboOpen(false);
                                      }}
                                      className="uppercase"
                                    >
                                      <Check
                                        className={cn(
                                          'size-4',
                                          String(candidate.id) === destinationInmateId
                                            ? 'opacity-100'
                                            : 'opacity-0',
                                        )}
                                      />
                                      {candidate.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {selectedDestinationCandidate?.inMovement && (
                          <p className="text-xs text-destructive">
                            Esse preso está em movimentação temporária. Registre o retorno antes de
                            confirmar a permuta.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

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
