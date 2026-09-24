import type { Paginated } from '../structure/types';
import type { Shift } from '../staff/types';

export type { Paginated };

export interface InmateMovementReportItem {
  movementId: number;
  movementTypeName: string;
  category: 'TEMPORARY' | 'PERMANENT';
  destinationLocation: string;
  reason: string | null;
  exitDateTime: string;
  returnDateTime: string | null;
  registeredByName: string;
}

export interface LongestOutOfCellItem {
  inmateId: number;
  inmateName: string;
  hoursOut: number;
  openMovementCount: number;
}

export interface MovementWithoutReturn {
  movementId: number;
  inmateId: number;
  inmateName: string;
  exitDateTime: string;
  hoursOpen: number;
}

export interface InmateOutWithoutReason {
  movementId: number;
  inmateId: number;
  inmateName: string;
  destinationLocation: string;
  exitDateTime: string;
}

export interface InconsistenciesReport {
  movementsWithoutReturn: MovementWithoutReturn[];
  movementsWithoutReturnTotal: number;
  inmatesOutWithoutReason: InmateOutWithoutReason[];
  inmatesOutWithoutReasonTotal: number;
  routinesNotExecuted: never[];
}

export interface RoutineExecutionItem {
  routineId: number;
  routineName: string;
  galleryId: number;
  galleryCode: string;
  scheduledOccurrences: number;
  skippedOccurrences: number;
}

export interface RoutineExecutionReport {
  from: string;
  to: string;
  executionTracked: boolean;
  data: RoutineExecutionItem[];
  total: number;
}

export interface StaffVsMovementsItem {
  shift: Shift;
  scheduledOfficers: number;
  absentOfficers: number;
  presentOfficers: number;
  movementCount: number;
  movementsPerPresentOfficer: number | null;
}

export type CellHistoryReason =
  | 'RELEASE'
  | 'ANKLE_MONITOR'
  | 'TRANSFER'
  | 'CELL_CHANGE'
  | 'CELL_SWAP'
  | 'GALLERY_CHANGE'
  | 'GALLERY_SWAP';

export interface CellOccupancyHistoryItem {
  historyId: number;
  inmateId: number;
  inmateName: string;
  entryDate: string;
  exitDate: string | null;
  reason: CellHistoryReason | null;
}

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT';

export interface AuditLogEntry {
  id: number;
  userId: number | null;
  userName: string | null;
  affectedTable: string | null;
  recordId: number | null;
  action: AuditAction;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  timestamp: string;
}
