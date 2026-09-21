import type { RoutineType } from './types';

export const ROUTINE_TYPE_LABEL: Record<RoutineType, string> = {
  DAILY: 'Diária',
  WEEKDAY: 'Dia da semana',
  VISIT_DAY: 'Dia de visita',
  WEEKEND: 'Final de semana',
  HOLIDAY: 'Feriado',
};

export const ROUTINE_TYPE_OPTIONS: { value: RoutineType; label: string }[] = (
  Object.entries(ROUTINE_TYPE_LABEL) as [RoutineType, string][]
).map(([value, label]) => ({ value, label }));

export const WEEKDAY_LABEL: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
};

export function weekdayLabel(weekday: number | null): string {
  return weekday === null ? 'Todos os dias' : (WEEKDAY_LABEL[weekday] ?? '—');
}
