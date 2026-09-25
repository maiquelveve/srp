import { isAxiosError } from 'axios';

export interface RoutineOverlap {
  routineId: number;
  routineName: string;
  weekday: number | null;
  time: string;
}

interface OverlapErrorBody {
  details?: { code?: string; overlaps?: RoutineOverlap[] };
}

/** Rotinas que o backend apontou como sobrepostas (`409` `ROUTINE_SCHEDULE_OVERLAP`), ou `null` para qualquer outro erro. */
export function getRoutineOverlaps(error: unknown): RoutineOverlap[] | null {
  if (!isAxiosError<OverlapErrorBody>(error) || error.response?.status !== 409) {
    return null;
  }
  const details = error.response.data?.details;
  return details?.code === 'ROUTINE_SCHEDULE_OVERLAP' ? (details.overlaps ?? null) : null;
}
