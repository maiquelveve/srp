import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { RoutineScheduleItemDto } from './routine-schedule-item.dto';

/** `PATCH /routines/:id/schedule` — replaces every schedule row of the routine (FR-019). */
export class UpdateRoutineScheduleDto {
  /** No máximo 3 horários por rotina (feedback do usuário) — mesmo limite de `CreateRoutineDto`. */
  @ValidateNested({ each: true })
  @Type(() => RoutineScheduleItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  schedules: RoutineScheduleItemDto[];
}
