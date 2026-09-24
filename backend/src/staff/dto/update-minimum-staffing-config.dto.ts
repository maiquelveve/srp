import { IsEnum, IsInt, Min } from 'class-validator';
import { Shift } from '../entities/staff-schedule.entity';

/** `PATCH /staff/minimum-staffing-config` — contracts/staff.md (FR-024, research.md #12). */
export class UpdateMinimumStaffingConfigDto {
  @IsInt()
  postId: number;

  @IsEnum(Shift)
  shift: Shift;

  @IsInt()
  @Min(1)
  minimumHeadcount: number;
}
