import { MovementCategory } from '../../movements/entities/movement-type.entity';
import { Shift } from '../../staff/entities/staff-schedule.entity';
import { CellHistoryReason } from '../../inmates/entities/inmate-cell-history.entity';

export class InmateMovementReportItemDto {
  movementId: number;
  movementTypeName: string;
  category: MovementCategory;
  destinationLocation: string;
  reason: string | null;
  exitDateTime: Date;
  returnDateTime: Date | null;
  registeredByName: string;
}

export class LongestOutOfCellItemDto {
  inmateId: number;
  inmateName: string;
  hoursOut: number;
  openMovementCount: number;
}

export class MovementWithoutReturnDto {
  movementId: number;
  inmateId: number;
  inmateName: string;
  exitDateTime: Date;
  hoursOpen: number;
}

export class InmateOutWithoutReasonDto {
  movementId: number;
  inmateId: number;
  inmateName: string;
  destinationLocation: string;
  exitDateTime: Date;
}

/**
 * `routinesNotExecuted` is always empty: routines are collective schedules
 * (FR-017, Entidades-Chave) and the system records no execution event for
 * them, so non-execution cannot be detected (see tasks.md T069 note).
 */
export class InconsistenciesReportDto {
  movementsWithoutReturn: MovementWithoutReturnDto[];
  movementsWithoutReturnTotal: number;
  inmatesOutWithoutReason: InmateOutWithoutReasonDto[];
  inmatesOutWithoutReasonTotal: number;
  routinesNotExecuted: never[];
}

export class RoutineExecutionItemDto {
  routineId: number;
  routineName: string;
  galleryId: number;
  galleryCode: string;
  scheduledOccurrences: number;
  skippedOccurrences: number;
}

export class RoutineExecutionReportDto {
  from: string;
  to: string;
  /** Always `false`: there is no per-execution record to measure compliance or delay against. */
  executionTracked: boolean;
  data: RoutineExecutionItemDto[];
  total: number;
}

export class StaffVsMovementsItemDto {
  shift: Shift;
  scheduledOfficers: number;
  absentOfficers: number;
  presentOfficers: number;
  movementCount: number;
  movementsPerPresentOfficer: number | null;
}

export class CellOccupancyHistoryItemDto {
  historyId: number;
  inmateId: number;
  inmateName: string;
  entryDate: Date;
  exitDate: Date | null;
  reason: CellHistoryReason | null;
}
