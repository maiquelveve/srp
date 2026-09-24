import type { AttendanceStatus, Shift } from './types';

export const SHIFT_LABEL: Record<Shift, string> = {
  DAY: 'Diurno',
  NIGHT: 'Noturno',
};

export const SHIFT_OPTIONS: { value: Shift; label: string }[] = (
  Object.entries(SHIFT_LABEL) as [Shift, string][]
).map(([value, label]) => ({ value, label }));

/** Cargas horárias de um dia de serviço oferecidas na escala (a API aceita de 1 a 24 h). */
export const WORKLOAD_HOURS_OPTIONS = [4, 6, 8, 10, 12, 16, 24];

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: 'Presente',
  ABSENT: 'Falta',
};

export const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string }[] = (
  Object.entries(ATTENDANCE_LABEL) as [AttendanceStatus, string][]
).map(([value, label]) => ({ value, label }));
