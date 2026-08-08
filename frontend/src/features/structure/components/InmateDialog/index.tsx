import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { structureApi } from '../../api';
import type { Inmate } from '../../types';
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

// Regime não é editável aqui de propósito: todo preso alcançável a partir de
// uma Cela é, por definição, regime fechado (research.md #9 / a listagem de
// presos da GalleryCards já parte dessa premissa pra nem mostrar a coluna
// Regime). Virar semiaberto/aberto tira o preso da cela — e isso só
// acontece via movimentação, no botão "Alterar situação", nunca aqui.
const FIXED_REGIME = 'CLOSED';

export interface InmateDialogProps {
  cellId: number;
  cellLabel: string;
  /** Presente = editar preso existente; ausente = cadastrar um novo. */
  inmate?: Inmate;
  children: ReactNode;
}

/**
 * Cadastro E edição de preso no mesmo formulário — a única diferença é qual
 * mutation dispara e se os campos vêm pré-preenchidos (`inmate` presente).
 * Cela aparece sempre travada/somente-leitura: um preso é sempre criado ou
 * editado dentro do contexto de UMA cela específica, e trocar de cela só
 * acontece via movimentação registrada (Constituição VI / research.md #9),
 * nunca por aqui — por isso nem `POST /inmates` nem `PATCH /inmates/:id`
 * deixam esse campo como um select editável.
 */
export default function InmateDialog({ cellId, cellLabel, inmate, children }: InmateDialogProps): JSX.Element {
  const isEdit = inmate !== undefined;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(inmate?.name ?? '');
  const [registrationId, setRegistrationId] = useState(inmate?.registrationId ?? '');
  const [birthDate, setBirthDate] = useState(inmate?.birthDate ?? '');

  const queryClient = useQueryClient();

  function handleOpenChange(next: boolean): void {
    if (next) {
      setName(inmate?.name ?? '');
      setRegistrationId(inmate?.registrationId ?? '');
      setBirthDate(inmate?.birthDate ?? '');
    }
    setOpen(next);
  }

  const formFields = {
    name,
    registrationId: registrationId || undefined,
    birthDate: birthDate || undefined,
    custodyRegime: FIXED_REGIME,
  };

  const createInmate = useMutation({
    mutationFn: () => structureApi.createInmate({ ...formFields, currentCellId: cellId }),
    onSuccess: () => {
      notify({ message: `${name} cadastrado`, type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['inmates', cellId] });
      void queryClient.invalidateQueries({ queryKey: ['cells'] });
      setOpen(false);
    },
    onError: () =>
      notify({ title: 'Não foi possível cadastrar', message: 'Verifique a capacidade da cela', type: 'error' }),
  });

  const updateInmate = useMutation({
    mutationFn: () => structureApi.updateInmate((inmate as Inmate).id, formFields),
    onSuccess: () => {
      notify({ message: `${name} atualizado`, type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['inmates', cellId] });
      setOpen(false);
    },
    onError: () => notify({ title: 'Não foi possível atualizar', message: 'Verifique os dados', type: 'error' }),
  });

  const mutation = isEdit ? updateInmate : createInmate;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar preso' : 'Cadastrar preso'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Cela</Label>
            <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
              {cellLabel}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Regime</Label>
            <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
              Fechado
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inmate-name">Nome</Label>
            <Input id="inmate-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inmate-registration">Matrícula</Label>
            <Input
              id="inmate-registration"
              value={registrationId}
              onChange={(e) => setRegistrationId(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inmate-birthdate">Data de nascimento</Label>
            <Input
              id="inmate-birthdate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={!name || mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
