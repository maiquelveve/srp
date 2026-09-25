import { apiClient } from '@/services/api-client';
import type {
  AuditLogEntry,
  CellOccupancyHistoryItem,
  InconsistenciesReport,
  InmateMovementReportItem,
  LongestOutOfCellItem,
  Paginated,
  RoutineExecutionReport,
  StaffVsMovementsItem,
} from './types';

export const reportsApi = {
  movementsByInmate: (inmateId: number, params: { days: number; limit: number; offset: number }) =>
    apiClient
      .get<Paginated<InmateMovementReportItem>>(`/reports/movements-by-inmate/${inmateId}`, {
        params,
      })
      .then((r) => r.data),

  longestOutOfCell: (params: { unitId: number; days: number; limit: number; offset: number }) =>
    apiClient
      .get<Paginated<LongestOutOfCellItem>>('/reports/longest-out-of-cell', { params })
      .then((r) => r.data),

  inconsistencies: (params: {
    unitId: number;
    thresholdHours: number;
    limit: number;
    withoutReturnOffset: number;
    withoutReasonOffset: number;
    notExecutedOffset: number;
  }) =>
    apiClient
      .get<InconsistenciesReport>('/reports/inconsistencies', { params })
      .then((r) => r.data),

  routineExecution: (params: { unitId: number; days: number; limit: number; offset: number }) =>
    apiClient
      .get<RoutineExecutionReport>('/reports/routine-execution', { params })
      .then((r) => r.data),

  staffVsMovements: (params: { unitId: number; date: string }) =>
    apiClient
      .get<Paginated<StaffVsMovementsItem>>('/reports/staff-vs-movements', { params })
      .then((r) => r.data),

  cellOccupancyHistory: (params: { cellId: number; limit: number; offset: number }) =>
    apiClient
      .get<Paginated<CellOccupancyHistoryItem>>('/reports/cell-occupancy-history', { params })
      .then((r) => r.data),

  listAudit: (params: {
    table?: string;
    recordId?: number;
    from?: string;
    to?: string;
    limit: number;
    offset: number;
  }) => apiClient.get<Paginated<AuditLogEntry>>('/audit', { params }).then((r) => r.data),
};
