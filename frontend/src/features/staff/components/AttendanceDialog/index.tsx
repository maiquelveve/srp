import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { staffApi } from '../../api';
import { ATTENDANCE_LABEL } from '../../labels';
import type { AttendanceStatus, Schedule } from '../../types';
import { notify } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Marks = Record<number, AttendanceStatus | undefined>;

/** Um policial por linha, mesmo que esteja escalado nos dois turnos: a presença é do dia. */
function officersOf(schedules: Schedule[]): Schedule[] {
  const byUser = new Map<number, Schedule>();
  for (const schedule of schedules) {
    if (!byUser.has(schedule.userId)) byUser.set(schedule.userId, schedule);
  }
  return [...byUser.values()].sort((a, b) => a.userName.localeCompare(b.userName));
}

/**
 * Presença do posto (SUPERVISOR/WARDEN, FR-023): lista os policiais escalados no
 * posto, marca presente ou falta de cada um e salva de uma vez. A marcação vale
 * para o dia todo, ou seja, para os dois turnos do policial.
 */
export default function AttendanceDialog({
  postName,
  schedules,
  children,
}: {
  postName: string;
  schedules: Schedule[];
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [marks, setMarks] = useState<Marks>({});
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const queryClient = useQueryClient();

  const officers = officersOf(schedules);

  function handleOpenChange(next: boolean): void {
    if (next) {
      setMarks(
        Object.fromEntries(
          officers.map((officer) => [officer.userId, officer.attendanceStatus ?? undefined]),
        ),
      );
      setReasons(
        Object.fromEntries(
          officers.map((officer) => [officer.userId, officer.absenceReason ?? '']),
        ),
      );
    }
    setOpen(next);
  }

  /** Motivo só existe para falta. */
  function reasonOf(officer: Schedule): string {
    return marks[officer.userId] === 'ABSENT' ? (reasons[officer.userId] ?? '').trim() : '';
  }

  const changed = officers.filter(
    (officer) =>
      marks[officer.userId] !== undefined &&
      (marks[officer.userId] !== officer.attendanceStatus ||
        reasonOf(officer) !== (officer.absenceReason ?? '')),
  );

  const mutation = useMutation({
    mutationFn: () =>
      Promise.all(
        changed.map((officer) =>
          staffApi.updateAttendance(officer.id, {
            attendanceStatus: marks[officer.userId] as AttendanceStatus,
            absenceReason: reasonOf(officer) || undefined,
          }),
        ),
      ),
    onSuccess: () => {
      notify({ message: 'Presenças registradas', type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
      // A falta desconta do efetivo do posto (FR-024).
      void queryClient.invalidateQueries({ queryKey: ['minimum-staffing'] });
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
          <DialogTitle>Presença</DialogTitle>
          <DialogDescription>Posto: {postName}</DialogDescription>
        </DialogHeader>

        <ul className="grid max-h-[60vh] gap-2 overflow-y-auto">
          {officers.map((officer) => (
            <li key={officer.userId} className="grid gap-2 rounded-md border border-border p-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">{officer.userName}</span>
                <div className="flex gap-1">
                  {(['PRESENT', 'ABSENT'] as const).map((status) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant={marks[officer.userId] === status ? 'default' : 'outline'}
                      aria-pressed={marks[officer.userId] === status}
                      onClick={() =>
                        setMarks((current) => ({ ...current, [officer.userId]: status }))
                      }
                    >
                      {ATTENDANCE_LABEL[status]}
                    </Button>
                  ))}
                </div>
              </div>
              {marks[officer.userId] === 'ABSENT' && (
                <Input
                  placeholder="Motivo (opcional)"
                  aria-label={`Motivo da falta de ${officer.userName}`}
                  value={reasons[officer.userId] ?? ''}
                  onChange={(event) =>
                    setReasons((current) => ({ ...current, [officer.userId]: event.target.value }))
                  }
                />
              )}
            </li>
          ))}
          {officers.length === 0 && (
            <li className="text-sm text-muted-foreground">Nenhum policial escalado neste posto.</li>
          )}
        </ul>

        <p className="text-sm text-muted-foreground">*A marcação valerá para os dois turnos.</p>

        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={changed.length === 0 || mutation.isPending}
          >
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
