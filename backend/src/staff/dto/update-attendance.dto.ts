import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AttendanceStatus } from '../entities/staff-schedule.entity';

/** `PATCH /schedules/:id/attendance` — contracts/staff.md (FR-023). */
export class UpdateAttendanceDto {
  @IsEnum(AttendanceStatus)
  attendanceStatus: AttendanceStatus;

  @IsOptional()
  @IsString()
  absenceReason?: string;
}
