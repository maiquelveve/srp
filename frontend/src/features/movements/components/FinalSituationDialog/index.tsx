import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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

type SituationType = 'RELEASE' | 'ANKLE_MONITOR' | 'TRANSFER';

const SITUATION_LABEL: Record<SituationType, string> = {
  RELEASE: 'Liberdade',
  ANKLE_MONITOR: 'Tornozeleira eletrônica',
  TRANSFER: 'Transferência',
};

// Rótulos só orientam o que escrever nos dois campos genéricos (reason/
// notes) — as três situações são estruturalmente idênticas na API
// (research.md #35, FR-008a). Troca/permuta de cela e de galeria saíram
// deste dialog — viram um fluxo próprio (CellTransferDialog).
const REASON_HINT: Record<SituationType, string> = {
  RELEASE: 'Alvará / unidade judiciária / agente responsável',
  ANKLE_MONITOR: 'Dispositivo / empresa responsável',
  TRANSFER: 'Unidade de destino / escolta',
};
const NOTES_HINT: Record<SituationType, string> = {
  RELEASE: 'Observações',
  ANKLE_MONITOR: 'Restrições',
  TRANSFER: 'Observações / referência documental',
};

export interface FinalSituationDialogProps {
  inmate: Inmate;
  children: ReactNode;
}

/**
 * Registra liberdade/tornozeleira/transferência (US3, FR-012…FR-014) a
 * partir do botão "Alterar situação" do Mapa da Unidade (`GalleryCards`) —
 * mesmo padrão de dialog único-que-muda-de-forma do `InmateDialog`/
 * `EntityDialog`/`MovementDialog`, aqui trocando de forma pelo tipo de
 * situação escolhido em vez de um modo fixo por instância.
 */
export default function FinalSituationDialog({
  inmate,
  children,
}: FinalSituationDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SituationType>('RELEASE');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const queryClient = useQueryClient();

  function handleOpenChange(next: boolean): void {
    if (next) {
      setType('RELEASE');
      setReason('');
      setNotes('');
    }
    setOpen(next);
  }

  const mutation = useMutation({
    mutationFn: () => {
      const input = { inmateId: inmate.id, reason, notes: notes || undefined };
      if (type === 'RELEASE') return movementsApi.finalRelease(input);
      if (type === 'ANKLE_MONITOR') return movementsApi.finalAnkleMonitor(input);
      return movementsApi.finalTransfer(input);
    },
    onSuccess: () => {
      notify({
        message: `Situação de ${inmate.name.toUpperCase()} atualizada (${SITUATION_LABEL[type]})`,
        type: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['inmates'] });
      void queryClient.invalidateQueries({ queryKey: ['cells'] });
      setOpen(false);
    },
    onError: () =>
      notify({
        title: `Não foi possível registrar ${SITUATION_LABEL[type].toLowerCase()}`,
        message: 'Verifique os dados e tente novamente',
        type: 'error',
      }),
  });

  const canSubmit = reason.trim() !== '';

  return (
    // Mesmo motivo do wrapper em MovementDialog: esta linha já está dentro do
    // InmateDialog (editar preso) que envolve a linha inteira — sem isso, um
    // clique no conteúdo deste dialog "vaza" e abre o de edição de cadastro
    // também.
    <div className="contents" onClick={(e) => e.stopPropagation()}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>{children}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar situação</DialogTitle>
            <DialogDescription className="flex items-center gap-1.5 uppercase">
              <User className="size-3.5" />
              {inmate.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="situation-type">Tipo de situação</Label>
              <Select value={type} onValueChange={(value) => setType(value as SituationType)}>
                <SelectTrigger id="situation-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SITUATION_LABEL) as SituationType[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {SITUATION_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="situation-reason">{REASON_HINT[type]}</Label>
              <Input id="situation-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="situation-notes">{NOTES_HINT[type]}</Label>
              <Input id="situation-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
