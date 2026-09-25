import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { routinesApi } from '../../api';
import { hasNoDuplicateTimes, isValidTime, toHHMM } from '../../time';
import type { Routine } from '../../types';
import { getRoutineOverlaps, type RoutineOverlap } from '../../overlap';
import OverlapConfirmAlert from '../OverlapConfirmAlert';
import ScheduleFieldsEditor, {
  MAX_SCHEDULES,
  type ScheduleFieldValue,
} from '../ScheduleFieldsEditor';
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

/** Ajuste de horários de uma Rotina existente (SUPERVISOR/WARDEN, FR-019). */
export default function ScheduleDialog({
  routine,
  galleryId,
  children,
}: {
  routine: Routine;
  galleryId: number;
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleFieldValue[]>([]);
  const [overlaps, setOverlaps] = useState<RoutineOverlap[] | null>(null);

  const queryClient = useQueryClient();

  function handleOpenChange(next: boolean): void {
    if (next) {
      setSchedules(routine.schedules.map((s) => ({ weekday: s.weekday, time: toHHMM(s.time) })));
    }
    setOpen(next);
  }

  const mutation = useMutation({
    mutationFn: (confirmOverlap: boolean) =>
      routinesApi.updateSchedule(
        routine.id,
        schedules.map((s) => ({ weekday: s.weekday, time: s.time })),
        confirmOverlap,
      ),
    onSuccess: () => {
      notify({ message: 'Horários atualizados', type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['routines', galleryId] });
      setOpen(false);
    },
    onError: (error) => {
      const found = getRoutineOverlaps(error);
      if (found) {
        setOverlaps(found);
        return;
      }
      notify({ title: 'Não foi possível salvar', message: 'Verifique os dados', type: 'error' });
    },
  });

  const canSubmit =
    schedules.length > 0 &&
    // Dados existentes anteriores a esta regra podem ter mais linhas do que
    // o limite atual (`ArrayMaxSize(3)` no backend) — sem esta checagem o
    // botão fica habilitado mas o `PATCH` sempre falha com 400, parecendo
    // que "não salva" sem nenhuma explicação visível (feedback do usuário).
    schedules.length <= MAX_SCHEDULES &&
    schedules.every((s) => isValidTime(s.time)) &&
    hasNoDuplicateTimes(schedules);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar horários</DialogTitle>
        </DialogHeader>

        <RoutineHeaderCard name={routine.name} />

        <ScheduleFieldsEditor value={schedules} onChange={setSchedules} />

        <DialogFooter>
          <Button
            onClick={() => mutation.mutate(false)}
            disabled={!canSubmit || mutation.isPending}
          >
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
      <OverlapConfirmAlert
        overlaps={overlaps}
        onCancel={() => setOverlaps(null)}
        onConfirm={() => {
          setOverlaps(null);
          mutation.mutate(true);
        }}
      />
    </Dialog>
  );
}
