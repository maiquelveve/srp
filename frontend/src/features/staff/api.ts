import { apiClient } from '@/services/api-client';
import type { Paginated } from '../structure/types';
import type {
  AttendanceStatus,
  MinimumStaffingConfig,
  MinimumStaffingReport,
  Officer,
  Post,
  Schedule,
  Shift,
} from './types';

export const staffApi = {
  listOfficers: (unitId: number) =>
    apiClient
      .get<Paginated<Officer>>('/users', { params: { role: 'PRISON_OFFICER', unitId } })
      .then((r) => r.data),

  listPosts: (params: { unitId: number; includeInactive?: boolean }) =>
    apiClient.get<Paginated<Post>>('/posts', { params }).then((r) => r.data),
  createPost: (input: { unitId: number; name: string }) =>
    apiClient.post<Post>('/posts', input).then((r) => r.data),
  updatePost: (postId: number, input: { name?: string; active?: boolean }) =>
    apiClient.patch<Post>(`/posts/${postId}`, input).then((r) => r.data),

  listSchedules: (params: { unitId: number; date: string; shift?: Shift }) =>
    apiClient.get<Paginated<Schedule>>('/schedules', { params }).then((r) => r.data),

  /** Registra o dia do policial: uma escala por turno informado, tudo ou nada (FR-022). */
  createSchedule: (input: {
    userId: number;
    unitId: number;
    date: string;
    workloadHours: number;
    assignments: { shift: Shift; postId: number }[];
  }) => apiClient.post<Paginated<Schedule>>('/schedules', input).then((r) => r.data),

  updateAttendance: (
    scheduleId: number,
    input: { attendanceStatus: AttendanceStatus; absenceReason?: string },
  ) => apiClient.patch<Schedule>(`/schedules/${scheduleId}/attendance`, input).then((r) => r.data),

  minimumStaffing: (params: { unitId: number; date: string; shift: Shift }) =>
    apiClient
      .get<MinimumStaffingReport>('/schedules/minimum-staffing', { params })
      .then((r) => r.data),

  updateMinimumStaffingConfig: (input: MinimumStaffingConfig) =>
    apiClient
      .patch<MinimumStaffingConfig>('/staff/minimum-staffing-config', input)
      .then((r) => r.data),
};
