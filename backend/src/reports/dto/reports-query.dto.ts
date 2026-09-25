import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Paginação comum das listas de relatório: `limit` (padrão 25, máx. 100) e `offset`. */
export class PageQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

/** `GET /reports/movements-by-inmate/:inmateId?days=&limit=&offset=` (FR-025). */
export class MovementsByInmateQueryDto extends PageQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;
}

/** `GET /reports/longest-out-of-cell?unitId=&days=&limit=&offset=` (FR-025). */
export class LongestOutOfCellQueryDto extends PageQueryDto {
  @IsOptional()
  @IsInt()
  unitId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;
}

/**
 * `GET /reports/inconsistencies?unitId=&thresholdHours=&limit=&withoutReturnOffset=&withoutReasonOffset=&notExecutedOffset=`
 * (FR-025, SC-005). As três listas são paginadas de forma independente.
 */
export class InconsistenciesQueryDto {
  @IsOptional()
  @IsInt()
  unitId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(720)
  thresholdHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  withoutReturnOffset?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  withoutReasonOffset?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  notExecutedOffset?: number;
}

/** `GET /reports/routine-execution?unitId=&days=&limit=&offset=` (FR-025). */
export class RoutineExecutionQueryDto extends PageQueryDto {
  @IsOptional()
  @IsInt()
  unitId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}

/** `GET /reports/staff-vs-movements?date=&unitId=` (FR-025). Sempre dois turnos, sem paginação. */
export class StaffVsMovementsQueryDto {
  @IsDateString()
  date: string;

  @IsOptional()
  @IsInt()
  unitId?: number;
}

/** `GET /reports/cell-occupancy-history?cellId=&from=&to=&limit=&offset=` (FR-025). */
export class CellOccupancyHistoryQueryDto extends PageQueryDto {
  @IsInt()
  cellId: number;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
