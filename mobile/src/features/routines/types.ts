export type RoutineType = 'DAILY' | 'WEEKDAY' | 'VISIT_DAY' | 'WEEKEND' | 'HOLIDAY';

export interface RoutineSchedule {
  id: number;
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
  schedules: RoutineSchedule[];
}
