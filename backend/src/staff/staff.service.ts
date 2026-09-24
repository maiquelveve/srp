import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, In, QueryFailedError, Repository } from 'typeorm';
import { AttendanceStatus, Shift, StaffSchedule } from './entities/staff-schedule.entity';
import { MinimumStaffingConfig } from './entities/minimum-staffing-config.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { ListSchedulesQueryDto } from './dto/list-schedules-query.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { MinimumStaffingQueryDto } from './dto/minimum-staffing-query.dto';
import { UpdateMinimumStaffingConfigDto } from './dto/update-minimum-staffing-config.dto';
import {
  MinimumStaffingConfigResponseDto,
  MinimumStaffingPostDto,
  MinimumStaffingReportDto,
  ScheduleResponseDto,
} from './dto/schedule-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { UnitsService } from '../units/units.service';
import { PostsService } from '../posts/posts.service';
import { ServicePost } from '../posts/entities/service-post.entity';
import { User } from '../users/entities/user.entity';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';

const UNIQUE_VIOLATION_CODE = '23505';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(StaffSchedule)
    private readonly scheduleRepository: Repository<StaffSchedule>,
    @InjectRepository(MinimumStaffingConfig)
    private readonly minimumStaffingRepository: Repository<MinimumStaffingConfig>,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly unitsService: UnitsService,
    private readonly postsService: PostsService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** `GET /schedules` (FR-022) — always restricted to the caller's units (FR-004a). */
  async listSchedules(
    query: ListSchedulesQueryDto,
    callerUnitIds: number[],
  ): Promise<PaginatedResponseDto<ScheduleResponseDto>> {
    const unitIds = await this.unitsService.resolveScope(query.unitId, callerUnitIds);
    if (unitIds.length === 0) {
      return new PaginatedResponseDto([], 0);
    }

    const where: FindOptionsWhere<StaffSchedule> = { unit: { id: In(unitIds) } };
    if (query.date) where.date = query.date;
    if (query.shift) where.shift = query.shift;
    if (query.postId) where.post = { id: query.postId };

    const schedules = await this.scheduleRepository.find({
      where,
      relations: { user: true, unit: true, post: true },
      order: { date: 'ASC', shift: 'ASC', id: 'ASC' },
    });
    return new PaginatedResponseDto(
      schedules.map((schedule) => ScheduleResponseDto.fromEntity(schedule)),
      schedules.length,
    );
  }

  /**
   * `POST /schedules` (FR-022): registra o dia do policial de uma vez, uma
   * escala por turno informado, tudo ou nada. A carga horária é do dia e tem
   * de bater com a de qualquer escala que ele já tenha na data (FR-022b); um
   * turno já escalado responde `409`.
   */
  async createSchedules(
    dto: CreateScheduleDto,
    currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<ScheduleResponseDto>> {
    const shifts = dto.assignments.map((assignment) => assignment.shift);
    if (new Set(shifts).size !== shifts.length) {
      throw new BadRequestException('Cada turno só pode aparecer uma vez');
    }

    const unit = await this.unitsService.findEntityInScope(dto.unitId, currentUser.units);
    const postByShift = new Map<Shift, ServicePost>();
    for (const assignment of dto.assignments) {
      const post = await this.postsService.findEntityInScope(assignment.postId, currentUser.units);
      if (post.unit.id !== unit.id) {
        throw new BadRequestException('O posto não pertence a esta unidade');
      }
      if (!post.active) {
        throw new BadRequestException('Posto inativo não pode receber escalas');
      }
      postByShift.set(assignment.shift, post);
    }
    const officer = await this.findOfficerInUnit(dto.userId, dto.unitId);

    const sameDaySchedules = await this.scheduleRepository.find({
      where: { user: { id: officer.id }, date: dto.date },
    });
    if (sameDaySchedules.some((existing) => postByShift.has(existing.shift))) {
      throw new ConflictException('Policial já escalado neste turno e data');
    }
    // A carga horária é do dia, não do turno: as escalas do mesmo policial na mesma data
    // (ex.: diurno e noturno de um plantão de 24 h) têm de informar o mesmo valor (FR-022b).
    const dayWorkloadHours = sameDaySchedules[0]?.workloadHours;
    if (dayWorkloadHours !== undefined && dayWorkloadHours !== dto.workloadHours) {
      throw new UnprocessableEntityException(
        `A carga horária do dia já está definida em ${dayWorkloadHours} h para este policial`,
      );
    }

    try {
      const saved = await this.dataSource.transaction((manager) =>
        manager.save(
          dto.assignments.map((assignment) =>
            manager.create(StaffSchedule, {
              user: officer,
              unit,
              post: postByShift.get(assignment.shift),
              date: dto.date,
              shift: assignment.shift,
              workloadHours: dto.workloadHours,
            }),
          ),
        ),
      );
      return new PaginatedResponseDto(
        saved.map((schedule) => ScheduleResponseDto.fromEntity(schedule)),
        saved.length,
      );
    } catch (error) {
      // Concurrent request slipped past the pre-check; the unique index is the real guard.
      if (error instanceof QueryFailedError && this.isUniqueViolation(error)) {
        throw new ConflictException('Policial já escalado neste turno e data');
      }
      throw error;
    }
  }

  /** `PATCH /schedules/:id/attendance` (FR-023). */
  async updateAttendance(
    id: number,
    dto: UpdateAttendanceDto,
    currentUser: JwtPayload,
  ): Promise<ScheduleResponseDto> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, unit: { id: In(currentUser.units) } },
      relations: { user: true, unit: true, post: true },
    });
    if (!schedule) {
      throw new NotFoundException('Escala não encontrada');
    }

    // A presença é do dia: vale para todas as escalas do policial na mesma data (diurno e noturno).
    await this.scheduleRepository.update(
      { user: { id: schedule.user.id }, unit: { id: schedule.unit.id }, date: schedule.date },
      { attendanceStatus: dto.attendanceStatus, absenceReason: dto.absenceReason ?? null },
    );
    schedule.attendanceStatus = dto.attendanceStatus;
    schedule.absenceReason = dto.absenceReason ?? null;
    return ScheduleResponseDto.fromEntity(schedule);
  }

  /** `PATCH /staff/minimum-staffing-config` (FR-024, research.md #12) — upsert per post/shift. */
  async upsertMinimumStaffingConfig(
    dto: UpdateMinimumStaffingConfigDto,
    currentUser: JwtPayload,
  ): Promise<MinimumStaffingConfigResponseDto> {
    const post = await this.postsService.findEntityInScope(dto.postId, currentUser.units);

    const config =
      (await this.minimumStaffingRepository.findOne({
        where: { post: { id: post.id }, shift: dto.shift },
      })) ?? this.minimumStaffingRepository.create({ post, shift: dto.shift });
    config.minimumHeadcount = dto.minimumHeadcount;
    config.updatedBy = { id: currentUser.sub } as User;
    await this.minimumStaffingRepository.save(config);

    return { postId: post.id, shift: dto.shift, minimumHeadcount: dto.minimumHeadcount };
  }

  /**
   * `GET /schedules/minimum-staffing` (FR-024): per post, the number of
   * officers actually at the post versus the configured minimum. Scheduled
   * officers marked ABSENT (falta) are not at the post, so
   * they leave `staffed` and are reported in `absent`. Active posts with a
   * configured minimum but nobody scheduled still appear (staffed 0), since
   * that is the worst deficit. Posts with schedules but no configured
   * minimum report `minimum: 0` and are never flagged. The minimum of an
   * inactive post is ignored (it can no longer receive schedules), but its
   * already-scheduled officers are still counted.
   */
  async minimumStaffingReport(
    query: MinimumStaffingQueryDto,
    callerUnitIds: number[],
  ): Promise<MinimumStaffingReportDto> {
    const unitIds = await this.unitsService.resolveScope(query.unitId, callerUnitIds);
    const postTotals = new Map<number, MinimumStaffingPostDto>();
    const totalsFor = (postId: number, postName: string): MinimumStaffingPostDto => {
      let totals = postTotals.get(postId);
      if (!totals) {
        totals = { postId, postName, staffed: 0, absent: 0, minimum: 0, belowMinimum: false };
        postTotals.set(postId, totals);
      }
      return totals;
    };

    if (unitIds.length > 0) {
      const schedules = await this.scheduleRepository.find({
        where: { unit: { id: In(unitIds) }, date: query.date, shift: query.shift },
        relations: { post: true },
      });
      for (const schedule of schedules) {
        const totals = totalsFor(schedule.post.id, schedule.post.name);
        // Falta deixa o posto sem ninguém: não conta como efetivo. Presença ainda não
        // registrada (`null`) conta, é a escala planejada.
        if (schedule.attendanceStatus === AttendanceStatus.ABSENT) {
          totals.absent += 1;
        } else {
          totals.staffed += 1;
        }
      }

      const configs = await this.minimumStaffingRepository.find({
        where: { post: { unit: { id: In(unitIds) }, active: true }, shift: query.shift },
        relations: { post: true },
      });
      for (const config of configs) {
        totalsFor(config.post.id, config.post.name).minimum = config.minimumHeadcount;
      }
    }

    const posts = [...postTotals.values()]
      .map((totals) => ({ ...totals, belowMinimum: totals.staffed < totals.minimum }))
      .sort((first, second) => first.postName.localeCompare(second.postName));

    return { date: query.date, shift: query.shift, posts };
  }

  private async findOfficerInUnit(userId: number, unitId: number): Promise<User> {
    const officer = await this.userRepository.findOne({
      where: { id: userId },
      relations: { role: true, units: true },
    });
    if (!officer) {
      throw new NotFoundException('Policial não encontrado');
    }
    if (officer.role.name !== RoleName.PRISON_OFFICER) {
      throw new BadRequestException('Somente policiais penais podem ser escalados');
    }
    if (!officer.active) {
      throw new BadRequestException('Policial inativo não pode ser escalado');
    }
    if (!officer.units.some((unit) => unit.id === unitId)) {
      throw new BadRequestException('Policial não está vinculado a esta unidade');
    }
    return officer;
  }

  private isUniqueViolation(error: QueryFailedError): boolean {
    return (error.driverError as { code?: string } | undefined)?.code === UNIQUE_VIOLATION_CODE;
  }
}
