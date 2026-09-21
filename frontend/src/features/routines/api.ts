import { apiClient } from '@/services/api-client';
import type { Paginated } from '../structure/types';
import type { Routine, RoutineType } from './types';

interface ScheduleInput {
  weekday: number | null;
  time: string;
  active?: boolean;
}

export const routinesApi = {
  list: (params: { galleryId?: number; date?: string; includeInactive?: boolean }) =>
    apiClient.get<Paginated<Routine>>('/routines', { params }).then((r) => r.data),

  create: (input: {
    galleryId: number;
    name: string;
    type: RoutineType;
    description?: string;
    locked?: boolean;
    schedules: ScheduleInput[];
  }) => apiClient.post<Routine>('/routines', input).then((r) => r.data),

  updateSchedule: (routineId: number, schedules: ScheduleInput[]) =>
    apiClient.patch<Routine>(`/routines/${routineId}/schedule`, { schedules }).then((r) => r.data),

  updateActivation: (routineId: number, date: string, active: boolean) =>
    apiClient
      .patch<{ routineId: number; date: string; active: boolean }>(`/routines/${routineId}/activation`, {
        date,
        active,
      })
      .then((r) => r.data),

  remove: (routineId: number) => apiClient.delete(`/routines/${routineId}`).then(() => undefined),
};
