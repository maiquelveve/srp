import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Routine } from './entities/routine.entity';
import { RoutineSchedule } from './entities/routine-schedule.entity';
import { RoutineDateOverride } from './entities/routine-date-override.entity';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { RoutineScheduleItemDto } from './dto/routine-schedule-item.dto';
import { UpdateRoutineScheduleDto } from './dto/update-routine-schedule.dto';
import { UpdateRoutineActivationDto } from './dto/update-routine-activation.dto';
import { ListRoutinesQueryDto } from './dto/list-routines-query.dto';
import { RoutineResponseDto, RoutineScheduleResponseDto } from './dto/routine-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { GalleriesService } from '../galleries/galleries.service';
import { RoleName } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';

/** `HH:mm` e `HH:mm:ss` (coluna `time` do Postgres) comparam como `HH:mm`. */
function normalizeTime(time: string): string {
  return time.slice(0, 5);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class RoutinesService {
  constructor(
    @InjectRepository(Routine) private readonly routineRepository: Repository<Routine>,
    @InjectRepository(RoutineDateOverride)
    private readonly overrideRepository: Repository<RoutineDateOverride>,
    private readonly galleriesService: GalleriesService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /**
   * `GET /routines?galleryId=&date=` (contract's own example uses
   * `shift=today`). Default (read-only consultation, FR-020) only returns
   * routines that actually apply on the queried date: a `RoutineSchedule`
   * matching that weekday, and an effective active state (the
   * `RoutineDateOverride` for the date if one exists, otherwise the
   * routine's own `active`) of `true`. With `includeInactive=true` (the web
   * management screen) every routine of the gallery is returned instead,
   * `active` reflecting its true per-date status — so a routine deactivated
   * for that date is still visible (and manageable), not silently dropped.
   * `active`/`schedules` always reflect the per-date resolution, not the
   * raw stored defaults (research.md #40).
   */
  async list(
    query: ListRoutinesQueryDto,
    callerUnitIds: number[],
  ): Promise<PaginatedResponseDto<RoutineResponseDto>> {
    if (callerUnitIds.length === 0) {
      return new PaginatedResponseDto([], 0);
    }
    if (query.galleryId) {
      await this.galleriesService.findEntityInScope(query.galleryId, callerUnitIds);
    }

    const includeInactive = query.includeInactive === 'true';
    const targetDate = query.date ?? todayIsoDate();
    const weekday = new Date(`${targetDate}T00:00:00Z`).getUTCDay();

    const routinesQuery = this.routineRepository
      .createQueryBuilder('routine')
      .leftJoinAndSelect('routine.gallery', 'gallery')
      .leftJoinAndSelect('routine.schedules', 'schedule')
      .leftJoinAndSelect('routine.createdBy', 'createdBy')
      .where('gallery.unit_id IN (:...callerUnitIds)', { callerUnitIds });

    if (query.galleryId) {
      routinesQuery.andWhere('gallery.id = :galleryId', { galleryId: query.galleryId });
    }

    const routines = await routinesQuery.getMany();
    if (routines.length === 0) {
      return new PaginatedResponseDto([], 0);
    }

    const overrides = await this.overrideRepository.find({
      where: { date: targetDate, routine: { id: In(routines.map((r) => r.id)) } },
      relations: { routine: true },
    });
    const overrideByRoutineId = new Map(overrides.map((o) => [o.routine.id, o]));

    const result: RoutineResponseDto[] = [];
    for (const routine of routines) {
      const schedulesForDate = routine.schedules.filter(
        (s) => s.active && (s.weekday === null || s.weekday === weekday),
      );
      const override = overrideByRoutineId.get(routine.id);
      const effectiveActive = override ? override.active : routine.active;

      if (!includeInactive) {
        if (schedulesForDate.length === 0 || !effectiveActive) {
          continue;
        }
      }

      const dto = RoutineResponseDto.fromEntity(routine);
      dto.active = effectiveActive;
      dto.schedules = (includeInactive ? routine.schedules : schedulesForDate).map((s) =>
        RoutineScheduleResponseDto.fromEntity(s),
      );
      result.push(dto);
    }

    return new PaginatedResponseDto(result, result.length);
  }

  async create(dto: CreateRoutineDto, currentUser: JwtPayload): Promise<RoutineResponseDto> {
    this.assertNoDuplicateTimes(dto.schedules);
    const gallery = await this.galleriesService.findEntityInScope(dto.galleryId, currentUser.units);
    if (!dto.confirmOverlap) {
      await this.assertNoOverlapUnlessConfirmed(gallery.id, dto.schedules, null);
    }

    const routine = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Routine, {
          gallery,
          name: dto.name,
          type: dto.type,
          description: dto.description ?? null,
          active: true,
          locked: dto.locked ?? false,
          createdBy: { id: currentUser.sub } as User,
        }),
      );
      const schedules = await manager.save(
        dto.schedules.map((s) =>
          manager.create(RoutineSchedule, {
            routine: saved,
            weekday: s.weekday ?? null,
            time: s.time,
            active: s.active ?? true,
          }),
        ),
      );
      saved.schedules = schedules;
      return saved;
    });

    routine.gallery = gallery;
    return RoutineResponseDto.fromEntity(routine);
  }

  async updateSchedule(
    id: number,
    dto: UpdateRoutineScheduleDto,
    currentUser: JwtPayload,
  ): Promise<RoutineResponseDto> {
    const routine = await this.findEntityInScope(id, currentUser.units);
    this.assertEditable(routine, currentUser);
    this.assertNoDuplicateTimes(dto.schedules);
    if (!dto.confirmOverlap) {
      await this.assertNoOverlapUnlessConfirmed(routine.gallery.id, dto.schedules, routine.id);
    }

    const schedules = await this.dataSource.transaction(async (manager) => {
      await manager.delete(RoutineSchedule, { routine: { id } });
      return manager.save(
        dto.schedules.map((s) =>
          manager.create(RoutineSchedule, {
            routine,
            weekday: s.weekday ?? null,
            time: s.time,
            active: s.active ?? true,
          }),
        ),
      );
    });

    routine.schedules = schedules;
    return RoutineResponseDto.fromEntity(routine);
  }

  async updateActivation(
    id: number,
    dto: UpdateRoutineActivationDto,
    currentUser: JwtPayload,
  ): Promise<{ routineId: number; date: string; active: boolean }> {
    const routine = await this.findEntityInScope(id, currentUser.units);
    this.assertEditable(routine, currentUser);

    let override = await this.overrideRepository.findOne({
      where: { routine: { id }, date: dto.date },
    });
    if (override) {
      override.active = dto.active;
      override.updatedBy = { id: currentUser.sub } as User;
    } else {
      override = this.overrideRepository.create({
        routine,
        date: dto.date,
        active: dto.active,
        updatedBy: { id: currentUser.sub } as User,
      });
    }
    await this.overrideRepository.save(override);

    return { routineId: id, date: dto.date, active: dto.active };
  }

  async remove(id: number, currentUser: JwtPayload): Promise<void> {
    const routine = await this.findEntityInScope(id, currentUser.units);
    if (routine.locked) {
      throw new ConflictException('Rotina padrão não pode ser excluída');
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RoutineDateOverride, { routine: { id } });
      await manager.delete(RoutineSchedule, { routine: { id } });
      await manager.delete(Routine, { id });
    });
  }

  async findEntityInScope(id: number, callerUnitIds: number[]): Promise<Routine> {
    const routine = await this.routineRepository.findOne({
      where: { id },
      relations: { gallery: { unit: true }, schedules: true, createdBy: true },
    });
    if (!routine) {
      throw new NotFoundException('Rotina não encontrada');
    }
    if (!callerUnitIds.includes(routine.gallery.unit.id)) {
      throw new ForbiddenException('Fora do escopo de unidade do usuário');
    }
    return routine;
  }

  /** `locked=true` MUST reject SUPERVISOR on schedule/activation edits (FR-019, contracts/routines.md). */
  private assertEditable(routine: Routine, currentUser: JwtPayload): void {
    if (routine.locked && currentUser.role === RoleName.SUPERVISOR) {
      throw new ForbiddenException('Rotina padrão não pode ser alterada por este perfil');
    }
  }

  /**
   * Duas linhas só conflitam se puderem cair no mesmo dia real: mesmo
   * `weekday`, ou uma delas `null` ("todos os dias", que já cobre qualquer
   * dia específico) — E o mesmo `time`. Dias específicos diferentes (ex.:
   * domingo 15:00 e segunda 15:00) NÃO são repetidos: é o único jeito de
   * expressar "mesmo horário só nesses dias" sem usar "todos os dias"
   * (feedback do usuário — a primeira versão comparava só o `time`, o que
   * impedia rotinas como "domingo, quarta e sábado às 15:00").
   */
  /**
   * Edge case do spec.md (rotinas sobrepostas): uma rotina só tem horário de
   * início, então "sobrepor" = outra rotina ativa da mesma galeria com o mesmo
   * horário num dia em comum (weekday null vale para todos os dias). Não
   * bloqueia: responde 409 com `details.overlaps` e a Chefia/Diretor (ou o
   * Supervisor que ajusta o horário) reenvia com `confirmOverlap: true`.
   */
  private async assertNoOverlapUnlessConfirmed(
    galleryId: number,
    schedules: RoutineScheduleItemDto[],
    excludeRoutineId: number | null,
  ): Promise<void> {
    const otherRoutines = await this.routineRepository.find({
      where: { gallery: { id: galleryId }, active: true },
      relations: { schedules: true },
    });
    const overlaps: {
      routineId: number;
      routineName: string;
      weekday: number | null;
      time: string;
    }[] = [];
    for (const other of otherRoutines) {
      if (other.id === excludeRoutineId) continue;
      for (const existing of other.schedules) {
        if (!existing.active) continue;
        const conflicts = schedules.some((candidate) => {
          if (candidate.active === false) return false;
          const candidateWeekday = candidate.weekday ?? null;
          const sameDay =
            candidateWeekday === null ||
            existing.weekday === null ||
            candidateWeekday === existing.weekday;
          return sameDay && normalizeTime(candidate.time) === normalizeTime(existing.time);
        });
        if (conflicts) {
          overlaps.push({
            routineId: other.id,
            routineName: other.name,
            weekday: existing.weekday,
            time: normalizeTime(existing.time),
          });
        }
      }
    }
    if (overlaps.length > 0) {
      throw new ConflictException({
        message: `Horário sobrepõe a rotina "${overlaps[0].routineName}" na mesma galeria. Confirme para salvar mesmo assim.`,
        details: { code: 'ROUTINE_SCHEDULE_OVERLAP', overlaps },
      });
    }
  }

  private assertNoDuplicateTimes(schedules: RoutineScheduleItemDto[]): void {
    for (let firstIndex = 0; firstIndex < schedules.length; firstIndex++) {
      for (let secondIndex = firstIndex + 1; secondIndex < schedules.length; secondIndex++) {
        const firstSchedule = schedules[firstIndex];
        const secondSchedule = schedules[secondIndex];
        const firstWeekday = firstSchedule.weekday ?? null;
        const secondWeekday = secondSchedule.weekday ?? null;
        const sameDay =
          firstWeekday === null || secondWeekday === null || firstWeekday === secondWeekday;
        if (sameDay && firstSchedule.time === secondSchedule.time) {
          throw new BadRequestException(
            'Uma rotina não pode ter dois horários iguais no mesmo dia',
          );
        }
      }
    }
  }
}
