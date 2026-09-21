export type RoutineType = 'DAILY' | 'WEEKDAY' | 'VISIT_DAY' | 'WEEKEND' | 'HOLIDAY';

export interface RoutineSchedule {
  id: number;
  /** 0 (domingo) .. 6 (sábado); `null` = todos os dias. */
  weekday: number | null;
  time: string;
  active: boolean;
}

export interface Routine {
  id: number;
  name: string;
  type: RoutineType;
  description: string | null;
  galleryId: number;
  locked: boolean;
  active: boolean;
  createdById: number | null;
  schedules: RoutineSchedule[];
  createdAt: string;
  updatedAt: string;
}
