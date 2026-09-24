import { AttendanceStatus, Shift, StaffSchedule } from '../entities/staff-schedule.entity';

export class ScheduleResponseDto {
  id: number;
  userId: number;
  userName: string;
  unitId: number;
  postId: number;
  postName: string;
  date: string;
  shift: Shift;
  workloadHours: number;
  attendanceStatus: AttendanceStatus | null;
  absenceReason: string | null;

  static fromEntity(schedule: StaffSchedule): ScheduleResponseDto {
    const dto = new ScheduleResponseDto();
    dto.id = schedule.id;
    dto.userId = schedule.user.id;
    dto.userName = schedule.user.name;
    dto.unitId = schedule.unit.id;
    dto.postId = schedule.post.id;
    dto.postName = schedule.post.name;
    dto.date = schedule.date;
    dto.shift = schedule.shift;
    dto.workloadHours = schedule.workloadHours;
    dto.attendanceStatus = schedule.attendanceStatus;
    dto.absenceReason = schedule.absenceReason;
    return dto;
  }
}

export class MinimumStaffingConfigResponseDto {
  postId: number;
  shift: Shift;
  minimumHeadcount: number;
}

export class MinimumStaffingPostDto {
  postId: number;
  postName: string;
  /** Escalados que não constam como falta: quem de fato está no posto. */
  staffed: number;
  /** Escalados ausentes (falta); não contam como efetivo. */
  absent: number;
  minimum: number;
  belowMinimum: boolean;
}

export class MinimumStaffingReportDto {
  date: string;
  shift: Shift;
  posts: MinimumStaffingPostDto[];
}
