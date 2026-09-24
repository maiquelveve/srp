import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Movement } from '../movements/entities/movement.entity';
import { MovementCategory } from '../movements/entities/movement-type.entity';
import { Inmate } from '../inmates/entities/inmate.entity';
import { InmateCellHistory } from '../inmates/entities/inmate-cell-history.entity';
import { Cell } from '../cells/entities/cell.entity';
import { Routine } from '../routines/entities/routine.entity';
import { RoutineDateOverride } from '../routines/entities/routine-date-override.entity';
import { AttendanceStatus, Shift, StaffSchedule } from '../staff/entities/staff-schedule.entity';
import { UnitsService } from '../units/units.service';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import {
  CellOccupancyHistoryQueryDto,
  InconsistenciesQueryDto,
  LongestOutOfCellQueryDto,
  MovementsByInmateQueryDto,
  RoutineExecutionQueryDto,
  StaffVsMovementsQueryDto,
} from './dto/reports-query.dto';
import {
  CellOccupancyHistoryItemDto,
  InconsistenciesReportDto,
  InmateMovementReportItemDto,
  LongestOutOfCellItemDto,
  RoutineExecutionItemDto,
  RoutineExecutionReportDto,
  StaffVsMovementsItemDto,
} from './dto/report-responses.dto';

const DEFAULT_PERIOD_DAYS = 30;
const DEFAULT_ROUTINE_PERIOD_DAYS = 7;
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_THRESHOLD_HOURS = 24;
const MILLISECONDS_PER_HOUR = 3_600_000;
const MILLISECONDS_PER_DAY = 86_400_000;

/** Fuso do sistema prisional gaúcho — os turnos (diurno 07h–19h) são definidos em horário local. */
const LOCAL_TIME_ZONE = 'America/Sao_Paulo';
const DAY_SHIFT_START_HOUR = 7;
const NIGHT_SHIFT_START_HOUR = 19;

/** Read-only queries for User Story 6 (FR-025); always restricted to the caller's units (FR-004a). */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Movement) private readonly movementRepository: Repository<Movement>,
    @InjectRepository(Inmate) private readonly inmateRepository: Repository<Inmate>,
    @InjectRepository(InmateCellHistory)
    private readonly cellHistoryRepository: Repository<InmateCellHistory>,
    @InjectRepository(Cell) private readonly cellRepository: Repository<Cell>,
    @InjectRepository(Routine) private readonly routineRepository: Repository<Routine>,
    @InjectRepository(RoutineDateOverride)
    private readonly overrideRepository: Repository<RoutineDateOverride>,
    @InjectRepository(StaffSchedule)
    private readonly scheduleRepository: Repository<StaffSchedule>,
    private readonly unitsService: UnitsService,
  ) {}

  async movementsByInmate(
    inmateId: number,
    query: MovementsByInmateQueryDto,
    callerUnitIds: number[],
  ): Promise<PaginatedResponseDto<InmateMovementReportItemDto>> {
    const inmate = await this.inmateRepository.findOne({
      where: { id: inmateId },
      relations: { currentCell: { gallery: { unit: true } } },
    });
    if (!inmate) {
      throw new NotFoundException('Preso não encontrado');
    }
    if (!callerUnitIds.includes(inmate.currentCell.gallery.unit.id)) {
      throw new ForbiddenException('Fora do escopo de unidade do usuário');
    }

    const since = new Date(Date.now() - (query.days ?? DEFAULT_PERIOD_DAYS) * MILLISECONDS_PER_DAY);
    const [movements, total] = await this.movementRepository
      .createQueryBuilder('movement')
      .innerJoinAndSelect('movement.movementType', 'movementType')
      .innerJoinAndSelect('movement.user', 'registeredBy')
      .where('movement.inmate = :inmateId', { inmateId })
      .andWhere('movement.exitDateTime >= :since', { since })
      .orderBy('movement.exitDateTime', 'DESC')
      .addOrderBy('movement.id', 'DESC')
      .take(query.limit ?? DEFAULT_PAGE_SIZE)
      .skip(query.offset ?? 0)
      .getManyAndCount();

    const items = movements.map((movement) => {
      const item = new InmateMovementReportItemDto();
      item.movementId = movement.id;
      item.movementTypeName = movement.movementType.name;
      item.category = movement.movementType.category;
      item.destinationLocation = movement.destinationLocation;
      item.reason = movement.reason;
      item.exitDateTime = movement.exitDateTime;
      item.returnDateTime = movement.returnDateTime;
      item.registeredByName = movement.user.name;
      return item;
    });
    return new PaginatedResponseDto(items, total);
  }

  /** Total de horas fora da cela por preso (movimentações temporárias; as em aberto contam até agora). */
  async longestOutOfCell(
    query: LongestOutOfCellQueryDto,
    callerUnitIds: number[],
  ): Promise<PaginatedResponseDto<LongestOutOfCellItemDto>> {
    const unitIds = await this.resolveUnitScope(query.unitId, callerUnitIds);
    if (unitIds.length === 0) {
      return new PaginatedResponseDto([], 0);
    }
    const since = new Date(Date.now() - (query.days ?? DEFAULT_PERIOD_DAYS) * MILLISECONDS_PER_DAY);

    const buildBase = () =>
      this.movementRepository
        .createQueryBuilder('movement')
        .innerJoin('movement.movementType', 'movementType')
        .innerJoin('movement.inmate', 'inmate')
        .innerJoin('movement.originCell', 'originCell')
        .innerJoin('originCell.gallery', 'gallery')
        .where('movementType.category = :category', { category: MovementCategory.TEMPORARY })
        .andWhere('gallery.unit IN (:...unitIds)', { unitIds })
        .andWhere('movement.exitDateTime >= :since', { since });

    const totalRow = await buildBase()
      .select('COUNT(DISTINCT inmate.id)', 'total')
      .getRawOne<{ total: string }>();

    const rows = await buildBase()
      .select('inmate.id', 'inmateId')
      .addSelect('inmate.name', 'inmateName')
      .addSelect(
        'SUM(EXTRACT(EPOCH FROM (COALESCE(movement.returnDateTime, NOW()) - movement.exitDateTime))) / 3600',
        'hoursOut',
      )
      .addSelect('COUNT(*) FILTER (WHERE movement.returnDateTime IS NULL)', 'openMovementCount')
      .groupBy('inmate.id')
      .addGroupBy('inmate.name')
      .orderBy('"hoursOut"', 'DESC')
      .addOrderBy('inmate.id', 'ASC')
      .limit(query.limit ?? DEFAULT_PAGE_SIZE)
      .offset(query.offset ?? 0)
      .getRawMany<{
        inmateId: number;
        inmateName: string;
        hoursOut: string;
        openMovementCount: string;
      }>();

    const items = rows.map((row) => {
      const item = new LongestOutOfCellItemDto();
      item.inmateId = Number(row.inmateId);
      item.inmateName = row.inmateName;
      item.hoursOut = Math.round(Number(row.hoursOut) * 10) / 10;
      item.openMovementCount = Number(row.openMovementCount);
      return item;
    });
    return new PaginatedResponseDto(items, Number(totalRow?.total ?? 0));
  }

  async inconsistencies(
    query: InconsistenciesQueryDto,
    callerUnitIds: number[],
  ): Promise<InconsistenciesReportDto> {
    const report = new InconsistenciesReportDto();
    report.movementsWithoutReturn = [];
    report.movementsWithoutReturnTotal = 0;
    report.inmatesOutWithoutReason = [];
    report.inmatesOutWithoutReasonTotal = 0;
    report.routinesNotExecuted = [];

    const unitIds = await this.resolveUnitScope(query.unitId, callerUnitIds);
    if (unitIds.length === 0) {
      return report;
    }
    const thresholdHours = query.thresholdHours ?? DEFAULT_THRESHOLD_HOURS;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const now = Date.now();
    const lateCutoff = new Date(now - thresholdHours * MILLISECONDS_PER_HOUR);

    const buildOpenMovements = () =>
      this.movementRepository
        .createQueryBuilder('movement')
        .innerJoinAndSelect('movement.inmate', 'inmate')
        .innerJoin('movement.movementType', 'movementType')
        .innerJoin('movement.originCell', 'originCell')
        .innerJoin('originCell.gallery', 'gallery')
        .where('movementType.category = :category', { category: MovementCategory.TEMPORARY })
        .andWhere('movement.returnDateTime IS NULL')
        .andWhere('gallery.unit IN (:...unitIds)', { unitIds })
        .orderBy('movement.exitDateTime', 'ASC')
        .addOrderBy('movement.id', 'ASC')
        .take(limit);

    const [lateMovements, lateTotal] = await buildOpenMovements()
      .andWhere('movement.exitDateTime <= :lateCutoff', { lateCutoff })
      .skip(query.withoutReturnOffset ?? 0)
      .getManyAndCount();
    report.movementsWithoutReturnTotal = lateTotal;
    report.movementsWithoutReturn = lateMovements.map((movement) => ({
      movementId: movement.id,
      inmateId: movement.inmate.id,
      inmateName: movement.inmate.name,
      exitDateTime: movement.exitDateTime,
      hoursOpen: Math.floor((now - movement.exitDateTime.getTime()) / MILLISECONDS_PER_HOUR),
    }));

    const [noReasonMovements, noReasonTotal] = await buildOpenMovements()
      .andWhere("(movement.reason IS NULL OR TRIM(movement.reason) = '')")
      .skip(query.withoutReasonOffset ?? 0)
      .getManyAndCount();
    report.inmatesOutWithoutReasonTotal = noReasonTotal;
    report.inmatesOutWithoutReason = noReasonMovements.map((movement) => ({
      movementId: movement.id,
      inmateId: movement.inmate.id,
      inmateName: movement.inmate.name,
      destinationLocation: movement.destinationLocation,
      exitDateTime: movement.exitDateTime,
    }));
    return report;
  }

  /**
   * Ocorrências programadas por rotina no período (mesma regra de ativação do
   * `GET /routines`: override da data vence `Routine.active`). O sistema não
   * registra a execução de uma rotina coletiva, então só há "programada" e
   * "suprimida"; cumprimento/atraso real não é mensurável (`executionTracked: false`).
   */
  async routineExecution(
    query: RoutineExecutionQueryDto,
    callerUnitIds: number[],
  ): Promise<RoutineExecutionReportDto> {
    const days = query.days ?? DEFAULT_ROUTINE_PERIOD_DAYS;
    const dates = this.lastDates(days);
    const report = new RoutineExecutionReportDto();
    report.from = dates[0];
    report.to = dates[dates.length - 1];
    report.executionTracked = false;
    report.data = [];
    report.total = 0;

    const unitIds = await this.resolveUnitScope(query.unitId, callerUnitIds);
    if (unitIds.length === 0) {
      return report;
    }

    const [routines, total] = await this.routineRepository.findAndCount({
      where: { gallery: { unit: { id: In(unitIds) } } },
      relations: { gallery: true, schedules: true },
      order: { name: 'ASC', id: 'ASC' },
      take: query.limit ?? DEFAULT_PAGE_SIZE,
      skip: query.offset ?? 0,
    });
    report.total = total;
    if (routines.length === 0) {
      return report;
    }
    const overrides = await this.overrideRepository.find({
      where: { routine: { id: In(routines.map((routine) => routine.id)) }, date: In(dates) },
      relations: { routine: true },
    });
    const overrideByKey = new Map(
      overrides.map((override) => [`${override.routine.id}|${override.date}`, override.active]),
    );

    for (const routine of routines) {
      const item = new RoutineExecutionItemDto();
      item.routineId = routine.id;
      item.routineName = routine.name;
      item.galleryId = routine.gallery.id;
      item.galleryCode = routine.gallery.code;
      item.scheduledOccurrences = 0;
      item.skippedOccurrences = 0;

      for (const date of dates) {
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
        const occurrences = routine.schedules.filter(
          (schedule) =>
            schedule.active && (schedule.weekday === null || schedule.weekday === weekday),
        ).length;
        const effectiveActive = overrideByKey.get(`${routine.id}|${date}`) ?? routine.active;
        if (effectiveActive) {
          item.scheduledOccurrences += occurrences;
        } else {
          item.skippedOccurrences += occurrences;
        }
      }
      report.data.push(item);
    }
    return report;
  }

  /** Efetivo escalado versus movimentações registradas, por turno (diurno 07h–19h, horário local). */
  async staffVsMovements(
    query: StaffVsMovementsQueryDto,
    callerUnitIds: number[],
  ): Promise<PaginatedResponseDto<StaffVsMovementsItemDto>> {
    const unitIds = await this.resolveUnitScope(query.unitId, callerUnitIds);
    const items = [Shift.DAY, Shift.NIGHT].map((shift) => {
      const item = new StaffVsMovementsItemDto();
      item.shift = shift;
      item.scheduledOfficers = 0;
      item.absentOfficers = 0;
      item.presentOfficers = 0;
      item.movementCount = 0;
      item.movementsPerPresentOfficer = null;
      return item;
    });
    if (unitIds.length === 0) {
      return new PaginatedResponseDto(items, items.length);
    }

    const schedules = await this.scheduleRepository.find({
      where: { unit: { id: In(unitIds) }, date: query.date },
    });
    for (const schedule of schedules) {
      const item = items.find((candidate) => candidate.shift === schedule.shift);
      if (!item) continue;
      item.scheduledOfficers += 1;
      if (schedule.attendanceStatus === AttendanceStatus.ABSENT) {
        item.absentOfficers += 1;
      } else {
        item.presentOfficers += 1;
      }
    }

    const windowStart = `${query.date} ${String(DAY_SHIFT_START_HOUR).padStart(2, '0')}:00:00`;
    const nextDate = new Date(new Date(`${query.date}T00:00:00Z`).getTime() + MILLISECONDS_PER_DAY)
      .toISOString()
      .slice(0, 10);
    const windowEnd = `${nextDate} ${String(DAY_SHIFT_START_HOUR).padStart(2, '0')}:00:00`;
    const localExit = `(movement.exitDateTime AT TIME ZONE :zone)`;

    const hourlyRows = await this.movementRepository
      .createQueryBuilder('movement')
      .innerJoin('movement.originCell', 'originCell')
      .innerJoin('originCell.gallery', 'gallery')
      .select(`EXTRACT(HOUR FROM ${localExit})`, 'hour')
      .addSelect('COUNT(*)', 'total')
      .where('gallery.unit IN (:...unitIds)', { unitIds })
      .andWhere(`${localExit} >= :windowStart::timestamp`)
      .andWhere(`${localExit} < :windowEnd::timestamp`)
      .setParameters({ zone: LOCAL_TIME_ZONE, windowStart, windowEnd })
      .groupBy('hour')
      .getRawMany<{ hour: string; total: string }>();

    for (const row of hourlyRows) {
      const hour = Number(row.hour);
      const isDay = hour >= DAY_SHIFT_START_HOUR && hour < NIGHT_SHIFT_START_HOUR;
      const item = items.find((candidate) => candidate.shift === (isDay ? Shift.DAY : Shift.NIGHT));
      if (item) item.movementCount += Number(row.total);
    }
    for (const item of items) {
      item.movementsPerPresentOfficer =
        item.presentOfficers > 0
          ? Math.round((item.movementCount / item.presentOfficers) * 10) / 10
          : null;
    }
    return new PaginatedResponseDto(items, items.length);
  }

  async cellOccupancyHistory(
    query: CellOccupancyHistoryQueryDto,
    callerUnitIds: number[],
  ): Promise<PaginatedResponseDto<CellOccupancyHistoryItemDto>> {
    const cell = await this.cellRepository.findOne({
      where: { id: query.cellId },
      relations: { gallery: { unit: true } },
    });
    if (!cell) {
      throw new NotFoundException('Cela não encontrada');
    }
    if (!callerUnitIds.includes(cell.gallery.unit.id)) {
      throw new ForbiddenException('Fora do escopo de unidade do usuário');
    }

    const builder = this.cellHistoryRepository
      .createQueryBuilder('history')
      .innerJoinAndSelect('history.inmate', 'inmate')
      .where('history.cell = :cellId', { cellId: query.cellId })
      .orderBy('history.entryDate', 'DESC')
      .addOrderBy('history.id', 'DESC')
      .take(query.limit ?? DEFAULT_PAGE_SIZE)
      .skip(query.offset ?? 0);
    if (query.from) {
      builder.andWhere('(history.exitDate IS NULL OR history.exitDate >= :from)', {
        from: query.from,
      });
    }
    if (query.to) {
      builder.andWhere('history.entryDate <= :to', { to: query.to });
    }

    const [history, total] = await builder.getManyAndCount();
    const items = history.map((entry) => {
      const item = new CellOccupancyHistoryItemDto();
      item.historyId = entry.id;
      item.inmateId = entry.inmate.id;
      item.inmateName = entry.inmate.name;
      item.entryDate = entry.entryDate;
      item.exitDate = entry.exitDate;
      item.reason = entry.reason;
      return item;
    });
    return new PaginatedResponseDto(items, total);
  }

  private async resolveUnitScope(
    requestedUnitId: number | undefined,
    callerUnitIds: number[],
  ): Promise<number[]> {
    if (requestedUnitId === undefined) {
      return callerUnitIds;
    }
    const unit = await this.unitsService.findEntityInScope(requestedUnitId, callerUnitIds);
    return [unit.id];
  }

  /** Últimos `days` dias (inclusive hoje), em `YYYY-MM-DD`, do mais antigo ao mais recente. */
  private lastDates(days: number): string[] {
    const today = Date.now();
    const dates: string[] = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      dates.push(new Date(today - offset * MILLISECONDS_PER_DAY).toISOString().slice(0, 10));
    }
    return dates;
  }
}
