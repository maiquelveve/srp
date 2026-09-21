import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { routinesApi } from '../../api';
import { ROUTINE_TYPE_OPTIONS } from '../../labels';
import { hasNoDuplicateTimes, isValidTime } from '../../time';
import type { RoutineType } from '../../types';
import ScheduleFieldsEditor, { type ScheduleFieldValue } from '../ScheduleFieldsEditor';
import { notify } from '@/lib/notify';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

const EMPTY_SCHEDULE: ScheduleFieldValue = { weekday: null, time: '' };

/**
 * Criação de Rotina (WARDEN only, FR-017/FR-018) — não há edição dos campos
 * base (nome/tipo/descrição/padrão) depois de criada, só de horários
 * (`ScheduleDialog`) e ativação por dia (`ActivationDialog`), então este
 * dialog é só de criação (diferente do padrão create-e-edit-no-mesmo-form
 * usado em `EntityDialog`/`InmateDialog`).
 */
export default function RoutineDialog({
  galleryId,
  children,
}: {
  galleryId: number;
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<RoutineType | ''>('');
  const [description, setDescription] = useState('');
  const [locked, setLocked] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleFieldValue[]>([EMPTY_SCHEDULE]);

  const queryClient = useQueryClient();

  function handleOpenChange(next: boolean): void {
    if (next) {
      setName('');
      setType('');
      setDescription('');
      setLocked(false);
      setSchedules([EMPTY_SCHEDULE]);
    }
    setOpen(next);
  }

  const mutation = useMutation({
    mutationFn: () =>
      routinesApi.create({
        galleryId,
        name,
        type: type as RoutineType,
        description: description || undefined,
        locked,
        schedules: schedules.map((s) => ({ weekday: s.weekday, time: s.time })),
      }),
    onSuccess: () => {
      notify({ message: 'Rotina cadastrada', type: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['routines', galleryId] });
      setOpen(false);
    },
    onError: () =>
      notify({ title: 'Não foi possível salvar', message: 'Verifique os dados', type: 'error' }),
  });

  const canSubmit =
    name.length > 0 &&
    type.length > 0 &&
    schedules.every((s) => isValidTime(s.time)) &&
    hasNoDuplicateTimes(schedules);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar Rotina</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="routine-name">Nome</Label>
            <Input id="routine-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="routine-type">Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as RoutineType)}>
              <SelectTrigger id="routine-type">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {ROUTINE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="routine-description">Descrição (opcional)</Label>
            <Input
              id="routine-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <ScheduleFieldsEditor value={schedules} onChange={setSchedules} />

          <div className="flex items-center gap-2">
            <Checkbox
              id="routine-locked"
              checked={locked}
              onCheckedChange={(checked) => setLocked(checked === true)}
            />
            <Label htmlFor="routine-locked" className="font-normal">
              Definir como rotina padrão (não editável por Supervisor)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
