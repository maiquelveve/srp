/** HH:mm, 00–23 horas / 00–59 minutos — mesma regra do backend (`RoutineScheduleItemDto`). */
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: string): boolean {
  return TIME_REGEX.test(value);
}

/** Descarta segundos vindos do backend (`HH:mm:ss`, round-trip da coluna TIME do Postgres) — a UI nunca exibe segundos. */
export function toHHMM(time: string): string {
  return time.slice(0, 5);
}

export interface ScheduleTimeEntry {
  weekday: number | null;
  time: string;
}

/**
 * Duas linhas só conflitam se puderem cair no mesmo dia real: mesmo
 * `weekday`, ou uma delas `null` ("todos os dias", que já cobre qualquer dia
 * específico) — E o mesmo `time`. Dias específicos diferentes (ex.: domingo
 * 15:00 e segunda 15:00) não conflitam. Mesma regra do backend
 * (`RoutinesService.assertNoDuplicateTimes`).
 */
export function schedulesConflict(firstSchedule: ScheduleTimeEntry, secondSchedule: ScheduleTimeEntry): boolean {
  const sameDay =
    firstSchedule.weekday === null ||
    secondSchedule.weekday === null ||
    firstSchedule.weekday === secondSchedule.weekday;
  return sameDay && firstSchedule.time === secondSchedule.time;
}

export function hasNoDuplicateTimes(schedules: ScheduleTimeEntry[]): boolean {
  return schedules.every(
    (schedule, scheduleIndex) =>
      !schedules.some(
        (otherSchedule, otherIndex) => otherIndex !== scheduleIndex && schedulesConflict(schedule, otherSchedule),
      ),
  );
}
