import { PlusIcon, Trash2Icon } from 'lucide-react';
import { WEEKDAY_LABEL } from '../../labels';
import { isValidTime, schedulesConflict } from '../../time';
import TimeInput from '../TimeInput';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface ScheduleFieldValue {
  weekday: number | null;
  time: string;
}

const ALL_DAYS_VALUE = 'all';
/** Mais que isso deixa a coluna "Horários" da listagem ilegível (feedback do usuário) — mesmo limite do backend (`ArrayMaxSize(3)`). */
export const MAX_SCHEDULES = 3;

function duplicateErrorFor(rows: ScheduleFieldValue[], index: number): string | undefined {
  const row = rows[index];
  if (!isValidTime(row.time)) return undefined;
  const isDuplicate = rows.some((other, otherIndex) => otherIndex !== index && schedulesConflict(row, other));
  return isDuplicate ? 'Horário repetido' : undefined;
}

/**
 * Um horário programado por linha (dia da semana + hora); pelo menos uma
 * linha é obrigatória (FR-017), no máximo `MAX_SCHEDULES` (feedback do
 * usuário — uma rotina que precise do mesmo horário todo dia já usa "Todos
 * os dias" numa única linha, então nunca é preciso repetir horário).
 */
export default function ScheduleFieldsEditor({
  value,
  onChange,
}: {
  value: ScheduleFieldValue[];
  onChange: (next: ScheduleFieldValue[]) => void;
}): JSX.Element {
  function updateRow(index: number, patch: Partial<ScheduleFieldValue>): void {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number): void {
    onChange(value.filter((_, i) => i !== index));
  }

  function addRow(): void {
    onChange([...value, { weekday: null, time: '' }]);
  }

  return (
    <div className="grid gap-1.5">
      <Label>Horários</Label>
      <div className="grid gap-2">
        {value.map((row, index) => (
          <div key={index} className="flex items-start gap-2">
            <Select
              value={row.weekday === null ? ALL_DAYS_VALUE : String(row.weekday)}
              onValueChange={(next) =>
                updateRow(index, { weekday: next === ALL_DAYS_VALUE ? null : Number(next) })
              }
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DAYS_VALUE}>Todos os dias</SelectItem>
                {Object.entries(WEEKDAY_LABEL).map(([day, label]) => (
                  <SelectItem key={day} value={day}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TimeInput
              value={row.time}
              onChange={(time) => updateRow(index, { time })}
              error={duplicateErrorFor(value, index)}
              className="w-32"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => removeRow(index)}
              disabled={value.length === 1}
            >
              <Trash2Icon className="size-3.5" />
              <span className="sr-only">Remover horário</span>
            </Button>
          </div>
        ))}
      </div>
      {value.length < MAX_SCHEDULES ? (
        // mt-2 (em vez de depender só do gap do grid pai) — o anel de foco
        // dourado do último campo, ao ser focado, encostava visualmente
        // neste botão sem essa folga extra (feedback do usuário).
        <Button type="button" variant="outline" size="sm" className="mt-2 w-fit gap-1" onClick={addRow}>
          <PlusIcon className="size-3.5" />
          Adicionar horário
        </Button>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Máximo de {MAX_SCHEDULES} horários por rotina.
        </p>
      )}
    </div>
  );
}
