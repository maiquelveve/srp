import { Routine, RoutineType } from '../entities/routine.entity';
import { RoutineSchedule } from '../entities/routine-schedule.entity';

export class RoutineScheduleResponseDto {
  id: number;
  weekday: number | null;
  time: string;
  active: boolean;

  static fromEntity(schedule: RoutineSchedule): RoutineScheduleResponseDto {
    const dto = new RoutineScheduleResponseDto();
    dto.id = schedule.id;
    dto.weekday = schedule.weekday;
    dto.time = schedule.time;
    dto.active = schedule.active;
    return dto;
  }
}

export class RoutineResponseDto {
  id: number;
  name: string;
  type: RoutineType;
  description: string | null;
  galleryId: number;
  locked: boolean;
  active: boolean;
  createdById: number | null;
  schedules: RoutineScheduleResponseDto[];
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(routine: Routine): RoutineResponseDto {
    const dto = new RoutineResponseDto();
    dto.id = routine.id;
    dto.name = routine.name;
    dto.type = routine.type;
    dto.description = routine.description;
    dto.galleryId = routine.gallery.id;
    dto.locked = routine.locked;
    dto.active = routine.active;
    dto.createdById = routine.createdBy?.id ?? null;
    dto.schedules = (routine.schedules ?? []).map((s) => RoutineScheduleResponseDto.fromEntity(s));
    dto.createdAt = routine.createdAt;
    dto.updatedAt = routine.updatedAt;
    return dto;
  }
}
