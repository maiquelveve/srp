import { IsDateString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { Shift } from '../entities/staff-schedule.entity';

/** `GET /schedules/minimum-staffing?date=&shift=` — contracts/staff.md (FR-024). */
export class MinimumStaffingQueryDto {
  @IsDateString()
  date: string;

  @IsEnum(Shift)
  shift: Shift;

  @IsOptional()
  @IsInt()
  unitId?: number;
}
