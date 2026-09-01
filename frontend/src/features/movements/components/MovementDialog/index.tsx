import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User } from 'lucide-react';
import { movementsApi } from '../../api';
import type { Inmate } from '../../../structure/types';
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

export interface MovementDialogProps {
  inmate: Inmate;
  cellId: number;
  children: ReactNode;
  /**
   * `'default'` (o ícone "Mover preso"/"Registrar retorno") decide a forma
   * sozinho a partir de `inmate.inMovement`. `'edit'` (o texto amarelo com o
   * tipo da movimentação) sempre abre o formulário editável, pré-preenchido
   * com os dados reais da movimentação aberta — só faz sentido quando
   * `inmate.inMovement` já é `true` (o texto só existe nesse caso).
   */
  mode?: 'default' | 'edit';
}

/**
 * Registra saída/retorno de movimentação temporária (US2, FR-008/FR-009), e
 * também corrige uma movimentação aberta (`mode="edit"`, PATCH /movements/:id
 * — tipo/destino/motivo digitados errado) a partir do Mapa da Unidade
 * (`GalleryCards`) — mesmo padrão de dialog único-que-muda-de-forma do
 * `InmateDialog`/`EntityDialog`, aqui com três formas em vez de duas.
 */
export default function MovementDialog({
  inmate,
  cellId,
  children,
  mode = 'default',
}: MovementDialogProps): JSX.Element {
  const isReturning = inmate.inMovement;
  const isEditing = mode === 'edit';
  // Mostra o formulário editável (tipo/destino/motivo) tanto pra registrar
  // saída (não há movimentação nenhuma ainda) quanto pra corrigir uma já
  // aberta — só o modo "confirmar retorno" (isReturning && !isEditing) usa a
  // view somente-leitura.
  const showEditableForm = !isReturning || isEditing;

  const [open, setOpen] = useState(false);
  const [movementTypeId, setMovementTypeId] = useState('');
  const [destinationLocation, setDestinationLocation] = useState('');
  const [reason, setReason] = useState('');

  const queryClient = useQueryClient();

  const movementTypesQuery = useQuery({
    queryKey: ['movement-types'],
    queryFn: movementsApi.listTypes,
    enabled: open && showEditableForm,
  });
  const temporaryTypes = (movementTypesQuery.data ?? []).filter((t) => t.category === 'TEMPORARY');

  // Só busca os dados reais da movimentação aberta (tipo/destino/motivo —
  // `inmate.currentMovement` só traz o nome do tipo, não o id nem os outros
  // campos) quando efetivamente abrindo pra editar.
  const movementDetailsQuery = useQuery({
    queryKey: ['movements', 'detail', inmate.currentMovement?.movementId],
    queryFn: () => movementsApi.list({ inmateId: inmate.id, open: true }).then((r) => r.data[0]),
    enabled: open && isEditing && inmate.currentMovement !== null,
  });

  useEffect(() => {
    if (isEditing && movementDetailsQuery.data) {
      setMovementTypeId(String(movementDetailsQuery.data.movementTypeId));
      setDestinationLocation(movementDetailsQuery.data.destinationLocation);
      setReason(movementDetailsQuery.data.reason ?? '');
    }
  }, [isEditing, movementDetailsQuery.data]);

  function handleOpenChange(next: boolean): void {
    // Modo "registrar saída" sempre abre em branco; modo "editar" é
    // preenchido pelo effect acima assim que `movementDetailsQuery` resolve.
    if (next && !isEditing) {
      setMovementTypeId('');
      setDestinationLocation('');
      setReason('');
    }
    setOpen(next);
  }

  function onSuccess(message: string): void {
    notify({ message, type: 'success' });
    void queryClient.invalidateQueries({ queryKey: ['inmates', cellId] });
    setOpen(false);
  }

  const registerExit = useMutation({
    mutationFn: () =>
      movementsApi.createTemporary({
        inmateId: inmate.id,
        movementTypeId: Number(movementTypeId),
        originCellId: cellId,
        destinationLocation,
        reason,
      }),
    onSuccess: () => onSuccess(`Saída de ${inmate.name.toUpperCase()} registrada`),
    onError: () =>
      notify({ title: 'Não foi possível registrar a saída', message: 'Tente novamente', type: 'error' }),
  });

  const updateMovement = useMutation({
    // Só chamado a partir do formulário de edição, que só é alcançável
    // quando `inmate.currentMovement` existe (mode="edit" implica inMovement=true).
    mutationFn: () =>
      movementsApi.update(inmate.currentMovement!.movementId, {
        movementTypeId: Number(movementTypeId),
        destinationLocation,
        reason: reason || undefined,
      }),
    onSuccess: () => onSuccess(`Movimentação de ${inmate.name.toUpperCase()} atualizada`),
    onError: () =>
      notify({
        title: 'Não foi possível atualizar a movimentação',
        message: 'Tente novamente',
        type: 'error',
      }),
  });

  const registerReturn = useMutation({
    mutationFn: () => movementsApi.returnMovement(inmate.currentMovement!.movementId),
    onSuccess: () => onSuccess(`Retorno de ${inmate.name.toUpperCase()} registrado`),
    onError: () =>
      notify({ title: 'Não foi possível registrar o retorno', message: 'Tente novamente', type: 'error' }),
  });

  const mutation = isEditing ? updateMovement : isReturning ? registerReturn : registerExit;
  const canSubmit =
    isReturning && !isEditing
      ? true
      : movementTypeId !== '' &&
        destinationLocation.trim() !== '' &&
        reason.trim() !== '' &&
        !(isEditing && movementDetailsQuery.isLoading);

  return (
    // This dialog's trigger sits inside a table row that InmateDialog wraps
    // with its OWN DialogTrigger (edit preso) — GalleryCards renders
    // <InmateDialog>{row}</InmateDialog>, and MovementDialog is nested inside
    // that same row. <Dialog> itself renders no DOM node, but everything it
    // opens (DialogOverlay AND DialogContent, both portaled to <body> in the
    // DOM) stays a REACT child of it — and React bubbles synthetic click
    // events along the REACT tree, not the DOM tree, for portal children
    // (see react.dev/reference/react-dom/createPortal). So a click on the
    // Select/Input inside this dialog, or on the overlay backdrop to close
    // it, would otherwise keep bubbling straight through this row and into
    // InmateDialog's trigger, popping "editar preso" open too. One
    // `stopPropagation` on a wrapper around the whole `<Dialog>` — not just
    // `<DialogContent>` — catches both the overlay and the content.
    // `display: contents` keeps the wrapper out of the row's flex layout.
    <div className="contents" onClick={(e) => e.stopPropagation()}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar movimentação' : isReturning ? 'Registrar retorno' : 'Registrar saída'}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 uppercase">
              <User className="size-3.5" />
              {inmate.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {isReturning && !isEditing && inmate.currentMovement && (
              <>
                <div className="grid gap-1.5">
                  <Label>Tipo de movimentação</Label>
                  <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {inmate.currentMovement.movementTypeName}
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Saída registrada em</Label>
                  <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {new Date(inmate.currentMovement.exitDateTime).toLocaleString('pt-BR')}
                  </div>
                </div>
              </>
            )}

            {showEditableForm && (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="movement-type">Tipo de movimentação</Label>
                  <Select value={movementTypeId} onValueChange={setMovementTypeId}>
                    <SelectTrigger id="movement-type">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {temporaryTypes.map((type) => (
                        <SelectItem key={type.id} value={String(type.id)}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="movement-destination">Local de destino</Label>
                  <Input
                    id="movement-destination"
                    value={destinationLocation}
                    onChange={(e) => setDestinationLocation(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="movement-reason">Motivo</Label>
                  <Input id="movement-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending
                ? 'Salvando...'
                : isEditing
                  ? 'Salvar alterações'
                  : isReturning
                    ? 'Confirmar retorno'
                    : 'Registrar saída'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
