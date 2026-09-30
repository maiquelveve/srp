import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api';
import { MAX_UNITS_PER_USER } from '../../labels';
import UnitsCombobox from '../UnitsCombobox';
import type { AdminUser } from '../../types';
import type { Unit } from '@/features/structure/types';
import { notify } from '@/lib/notify';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import { Label } from '@/components/ui/label';

export interface AddUnitsDialogProps {
  user: AdminUser;
  units: Unit[];
  children: ReactNode;
}

/**
 * "Adicionar lotação" (FR-006a) — soma unidade(s) novas às já vinculadas,
 * sem remover nenhuma. Só oferece as unidades que o usuário ainda não tem, e
 * o combobox já limita a seleção às vagas restantes até o máximo de
 * `MAX_UNITS_PER_USER` (regra de negócio nova). O texto de confirmação é
 * deliberadamente diferente do de ReplaceUnitsDialog: deixa explícito que é
 * uma soma, não uma substituição (Edge Case do spec.md, FR-006a).
 */
export default function AddUnitsDialog({ user, units, children }: AddUnitsDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [unitIds, setUnitIds] = useState<number[]>([]);
  const queryClient = useQueryClient();

  const availableUnits = units.filter((unit) => !user.units.includes(unit.id));
  const remainingSlots = MAX_UNITS_PER_USER - user.units.length;
  const atUserLimit = remainingSlots <= 0;

  function handleOpenChange(next: boolean): void {
    if (next) {
      setUnitIds([]);
    }
    setOpen(next);
  }

  const mutation = useMutation({
    mutationFn: () => usersApi.addUnits(user.id, unitIds),
    onSuccess: () => {
      notify({ message: `Lotação de ${user.name} ampliada`, type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setOpen(false);
    },
    onError: () =>
      notify({ title: 'Não foi possível adicionar a lotação', message: 'Tente novamente', type: 'error' }),
  });

  const selectedNames = units
    .filter((unit) => unitIds.includes(unit.id))
    .map((unit) => unit.code ?? unit.name);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar lotação a {user.name}</DialogTitle>
          <DialogDescription>
            A unidade escolhida se soma à lotação atual, sem remover nenhuma.
          </DialogDescription>
        </DialogHeader>

        {atUserLimit ? (
          <p className="text-sm text-muted-foreground">
            {user.name} já está no limite de {MAX_UNITS_PER_USER} lotações simultâneas. Use "Trocar
            lotação" para substituir.
          </p>
        ) : availableUnits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {user.name} já está lotado em todas as unidades disponíveis.
          </p>
        ) : (
          <div className="grid gap-1.5">
            <Label>Unidade(s) a somar à lotação atual</Label>
            <UnitsCombobox
              candidateUnits={availableUnits}
              selectedIds={unitIds}
              onChange={setUnitIds}
              max={remainingSlots}
            />
          </div>
        )}

        <DialogFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={unitIds.length === 0 || mutation.isPending}>Adicionar lotação</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar adição de lotação?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso vai SOMAR {selectedNames.join(', ')} à lotação atual de {user.name}, sem remover
                  a que ele já tem. Ele passa a ter acesso aos dados das duas lotações. Esta ação NÃO
                  substitui a lotação existente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => mutation.mutate()}>Confirmar adição</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
