import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Shift } from '../entities/staff-schedule.entity';

/** Posto em que o policial fica em um dos turnos do dia. */
export class ScheduleAssignmentDto {
  @IsEnum(Shift)
  shift: Shift;

  @IsInt()
  postId: number;
}

/**
 * `POST /schedules` — contracts/staff.md (FR-022). Uma única escala cobre o
 * dia do policial: a carga horária e a data valem para todas as atribuições, e
 * cada atribuição diz o posto de um turno (pode mudar de um turno para o outro).
 */
export class CreateScheduleDto {
  @IsInt()
  userId: number;

  @IsInt()
  unitId: number;

  @IsDateString()
  date: string;

  /** Carga horária do policial no dia, obrigatória (FR-022b). */
  @IsInt()
  @Min(1)
  @Max(24)
  workloadHours: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => ScheduleAssignmentDto)
  assignments: ScheduleAssignmentDto[];
}
