import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { Shift } from '../entities/staff-schedule.entity';

/** `GET /schedules?date=&shift=&postId=` — contracts/staff.md (FR-022). */
export class ListSchedulesQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(Shift)
  shift?: Shift;

  @IsOptional()
  @IsInt()
  postId?: number;

  @IsOptional()
  @IsInt()
  unitId?: number;
}
