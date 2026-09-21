import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { RoutineType } from '../entities/routine.entity';
import { RoutineScheduleItemDto } from './routine-schedule-item.dto';

export class CreateRoutineDto {
  @IsInt()
  galleryId: number;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsEnum(RoutineType)
  type: RoutineType;

  @IsOptional()
  @IsString()
  description?: string;

  /** Só WARDEN pode marcar (FR-018) — rota já é `@Roles(WARDEN)`, sem checagem extra. */
  @IsOptional()
  @IsBoolean()
  locked?: boolean;

  /** No máximo 3 horários por rotina — uma listagem legível é preferível a um cadastro sem limite (feedback do usuário). */
  @ValidateNested({ each: true })
  @Type(() => RoutineScheduleItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  schedules: RoutineScheduleItemDto[];
}
