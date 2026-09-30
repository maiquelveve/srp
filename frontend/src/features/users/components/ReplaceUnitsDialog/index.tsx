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

export interface ReplaceUnitsDialogProps {
  user: AdminUser;
  units: Unit[];
  children: ReactNode;
}

/**
 * "Trocar lotação" (FR-006) — substitui integralmente a lotação do usuário.
 * Pede confirmação explícita (tasks.md T016) antes de efetivar, com um texto
 * de aviso diferente de "Adicionar lotação" (AddUnitsDialog) para não serem
 * confundidas (Edge Case do spec.md).
 */
export default function ReplaceUnitsDialog({ user, units, children }: ReplaceUnitsDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [unitIds, setUnitIds] = useState<number[]>(user.units);
  const queryClient = useQueryClient();

  function handleOpenChange(next: boolean): void {
    if (next) {
      setUnitIds(user.units);
    }
    setOpen(next);
  }

  const mutation = useMutation({
    mutationFn: () => usersApi.replaceUnits(user.id, unitIds),
    onSuccess: () => {
      notify({ message: `Lotação de ${user.name} atualizada`, type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setOpen(false);
    },
    onError: () =>
      notify({ title: 'Não foi possível trocar a lotação', message: 'Tente novamente', type: 'error' }),
  });

  const selectedNames = units
    .filter((unit) => unitIds.includes(unit.id))
    .map((unit) => unit.code ?? unit.name);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trocar lotação de {user.name}</DialogTitle>
          <DialogDescription>
            A seleção abaixo substitui integralmente a lotação atual (até {MAX_UNITS_PER_USER}{' '}
            unidades).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label>Nova lotação</Label>
          <UnitsCombobox candidateUnits={units} selectedIds={unitIds} onChange={setUnitIds} />
        </div>

        <DialogFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={unitIds.length === 0 || mutation.isPending}>Trocar lotação</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar troca de lotação?</AlertDialogTitle>
                <AlertDialogDescription>
                  A lotação atual de {user.name} será substituída por: {selectedNames.join(', ')}. Ele
                  perde o acesso aos dados restritos da lotação anterior.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => mutation.mutate()}>Confirmar troca</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
