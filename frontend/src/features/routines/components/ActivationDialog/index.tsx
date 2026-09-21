import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { routinesApi } from '../../api';
import type { Routine } from '../../types';
import DatePicker from '../DatePicker';
import RoutineHeaderCard from '../RoutineHeaderCard';
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Ativa/desativa uma Rotina para uma data específica (SUPERVISOR/WARDEN, FR-019). */
export default function ActivationDialog({
  routine,
  galleryId,
  children,
}: {
  routine: Routine;
  galleryId: number;
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayIsoDate());
  // Uma rotina recém-criada — e, no dia a dia, a grande maioria das rotinas —
  // está ATIVA por padrão; desativar por uma data é a exceção pontual, não o
  // estado inicial. Parte do status conhecido da própria rotina (reflete a
  // data atualmente filtrada na tela) em vez de assumir "Inativa" — assumir
  // o oposto do real fazia parecer que toda rotina nascia desativada.
  const [active, setActive] = useState<'true' | 'false'>(routine.active ? 'true' : 'false');

  const queryClient = useQueryClient();

  function handleOpenChange(next: boolean): void {
    if (next) {
      setDate(todayIsoDate());
      setActive(routine.active ? 'true' : 'false');
    }
    setOpen(next);
  }

  const mutation = useMutation({
    mutationFn: () => routinesApi.updateActivation(routine.id, date, active === 'true'),
    onSuccess: () => {
      notify({ message: 'Ativação por data atualizada', type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['routines', galleryId] });
      setOpen(false);
    },
    onError: () =>
      notify({ title: 'Não foi possível salvar', message: 'Verifique os dados', type: 'error' }),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ativar/desativar por data</DialogTitle>
        </DialogHeader>

        <RoutineHeaderCard name={routine.name} />

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="activation-date">Data</Label>
            <DatePicker id="activation-date" value={date} onChange={setDate} className="w-full" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="activation-status">Status nesta data</Label>
            <Select value={active} onValueChange={(v) => setActive(v as 'true' | 'false')}>
              <SelectTrigger id="activation-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Ativa</SelectItem>
                <SelectItem value="false">Inativa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={!date || mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
