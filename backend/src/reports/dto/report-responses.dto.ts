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

export class RoutineNotExecutedDto {
  routineId: number;
  routineName: string;
  galleryId: number;
  galleryCode: string;
  /** Data (YYYY-MM-DD) para a qual o Supervisor desativou a rotina. */
  date: string;
}

/**
 * `routinesNotExecuted` (FR-025): o sistema não registra a execução de uma
 * rotina coletiva, então "não executada" = rotina que o Supervisor desativou
 * para uma data do período; sem desativação, considera-se executada.
 */
export class InconsistenciesReportDto {
  movementsWithoutReturn: MovementWithoutReturnDto[];
  movementsWithoutReturnTotal: number;
  inmatesOutWithoutReason: InmateOutWithoutReasonDto[];
  inmatesOutWithoutReasonTotal: number;
  routinesNotExecuted: RoutineNotExecutedDto[];
  routinesNotExecutedTotal: number;
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
