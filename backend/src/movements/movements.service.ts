import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Movement } from './entities/movement.entity';
import { MovementCategory } from './entities/movement-type.entity';
import { MovementTypesService } from './movement-types.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { UpdateMovementDto } from './dto/update-movement.dto';
import { ReturnMovementDto } from './dto/return-movement.dto';
import { ListMovementsQueryDto } from './dto/list-movements-query.dto';
import { MovementResponseDto } from './dto/movement-response.dto';
import { FinalReleaseDto } from './dto/final-release.dto';
import { FinalAnkleMonitorDto } from './dto/final-ankle-monitor.dto';
import { FinalReversalDto } from './dto/final-reversal.dto';
import { FinalTransferDto } from './dto/final-transfer.dto';
import { CellTransferDto } from './dto/cell-transfer.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { InmatesService } from '../inmates/inmates.service';
import { CellHistoryService } from '../inmates/cell-history.service';
import { CellsService } from '../cells/cells.service';
import { CellHistoryReason } from '../inmates/entities/inmate-cell-history.entity';
import { Inmate, InmateStatus } from '../inmates/entities/inmate.entity';
import { Cell } from '../cells/entities/cell.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { User } from '../users/entities/user.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';

export interface CreateMovementResult {
  data: MovementResponseDto;
  /** True when this was a fresh insert (201); false when an Idempotency-Key replay returned the existing row (200). */
  created: boolean;
}

export interface ReturnMovementResult {
  data: MovementResponseDto;
  /** True when this call actually recorded the return; false when an Idempotency-Key replay returned the already-returned row. */
  returned: boolean;
}

/** Shared shape every situação-definitiva flow reduces to before `registerFinal` runs. */
interface FinalMovementInput {
  inmateId: number;
  movementTypeName: string;
  destinationLocation: string;
  destinationCell?: Cell;
  reason: string | null;
  notes: string | null;
  exitDateTime?: string;
  cellHistoryReason: CellHistoryReason;
  /** `null` means the inmate stays ACTIVE (troca de cela) — only currentCell changes. */
  newStatus: InmateStatus | null;
  /** Checks (under a lock, inside the transaction) that `destinationCell` still has a vacancy. */
  requireVacancy?: boolean;
  /** Only the reversal acts on an inmate that is NOT active; every other operation requires ACTIVE. */
  allowNonActiveInmate?: boolean;
}

const MOVEMENT_RELATIONS = {
  inmate: true,
  movementType: true,
  originCell: true,
  user: true,
} as const;

@Injectable()
export class MovementsService {
  constructor(
    @InjectRepository(Movement) private readonly movementRepository: Repository<Movement>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly movementTypesService: MovementTypesService,
    private readonly inmatesService: InmatesService,
    private readonly cellsService: CellsService,
    private readonly cellHistoryService: CellHistoryService,
    private readonly auditService: AuditService,
  ) {}

  async list(
    query: ListMovementsQueryDto,
    callerUnitIds: number[],
  ): Promise<PaginatedResponseDto<MovementResponseDto>> {
    if (callerUnitIds.length === 0) {
      return new PaginatedResponseDto([], 0);
    }

    const movementsQuery = this.movementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.inmate', 'inmate')
      .leftJoinAndSelect('movement.movementType', 'movementType')
      .leftJoinAndSelect('movement.originCell', 'originCell')
      .leftJoinAndSelect('movement.user', 'user')
      .innerJoin('originCell.gallery', 'gallery')
      .where('gallery.unit_id IN (:...callerUnitIds)', { callerUnitIds })
      .orderBy('movement.exit_datetime', 'DESC');

    if (query.inmateId) {
      movementsQuery.andWhere('movement.inmate_id = :inmateId', { inmateId: query.inmateId });
    }
    if (query.open === 'true') {
      movementsQuery.andWhere('movement.return_datetime IS NULL');
    } else if (query.open === 'false') {
      movementsQuery.andWhere('movement.return_datetime IS NOT NULL');
    }

    const [movements, total] = await movementsQuery.getManyAndCount();
    return new PaginatedResponseDto(
      movements.map((m) => MovementResponseDto.fromEntity(m)),
      total,
    );
  }

  async create(
    dto: CreateMovementDto,
    currentUser: JwtPayload,
    idempotencyKey?: string,
  ): Promise<CreateMovementResult> {
    if (idempotencyKey) {
      const existing = await this.movementRepository.findOne({
        where: { idempotencyKey },
        relations: MOVEMENT_RELATIONS,
      });
      if (existing) {
        return { data: MovementResponseDto.fromEntity(existing), created: false };
      }
    }

    const inmate = await this.inmatesService.findEntityInScope(dto.inmateId, currentUser.units);
    this.assertInmateActive(inmate);
    const originCell = await this.cellsService.findEntityInScope(
      dto.originCellId,
      currentUser.units,
    );
    const movementType = await this.movementTypesService.findById(dto.movementTypeId);

    if (movementType.category !== MovementCategory.TEMPORARY) {
      throw new BadRequestException(
        'POST /movements aceita apenas tipos de movimentação TEMPORARY — use /movements/final/* para situações definitivas',
      );
    }

    // FR-010 — no more than one open TEMPORARY movement per inmate at a time.
    // Check + insert run in one transaction holding a row lock on the inmate, so two
    // simultaneous exits for the same inmate serialize instead of both succeeding.
    const outcome = await this.dataSource.transaction(async (manager) => {
      const lockedInmate = await manager
        .getRepository(Inmate)
        .createQueryBuilder('inmate')
        .setLock('pessimistic_write')
        .where('inmate.id = :id', { id: inmate.id })
        .getOneOrFail();
      this.assertInmateActive(lockedInmate);

      if (idempotencyKey) {
        // A concurrent request with the same key may have committed while we waited for the lock.
        const replay = await manager.findOne(Movement, {
          where: { idempotencyKey },
          relations: MOVEMENT_RELATIONS,
        });
        if (replay) {
          return { data: MovementResponseDto.fromEntity(replay), created: false };
        }
      }

      await this.assertNoOpenTemporaryMovement(
        inmate.id,
        'Preso já possui movimentação em aberto',
        manager,
      );

      const saved = await manager.save(
        manager.create(Movement, {
          inmate,
          movementType,
          originCell,
          destinationLocation: dto.destinationLocation,
          reason: dto.reason ?? null,
          notes: dto.notes ?? null,
          exitDateTime: dto.exitDateTime ? new Date(dto.exitDateTime) : new Date(),
          returnDateTime: null,
          idempotencyKey: idempotencyKey ?? null,
          user: { id: currentUser.sub } as User,
        }),
      );
      saved.inmate = inmate;
      saved.movementType = movementType;
      saved.originCell = originCell;
      saved.user = { id: currentUser.sub } as User;
      return { data: MovementResponseDto.fromEntity(saved), created: true };
    });
    return outcome;
  }

  /**
   * Corrige uma movimentação TEMPORARY enquanto ainda está em aberto — ex.:
   * tipo/destino/motivo digitado errado ao registrar a saída. Uma vez
   * retornada, a linha é histórico fechado; não há edição depois disso (o
   * mesmo "fluxo de correção" ainda em aberto no spec.md pras situações
   * definitivas — usar uma nova movimentação corretiva nesse caso).
   */
  async update(
    id: number,
    dto: UpdateMovementDto,
    callerUnitIds: number[],
  ): Promise<MovementResponseDto> {
    const movement = await this.findEntityInScope(id, callerUnitIds);

    if (dto.movementTypeId !== undefined) {
      const movementType = await this.movementTypesService.findById(dto.movementTypeId);
      if (movementType.category !== MovementCategory.TEMPORARY) {
        throw new BadRequestException(
          'PATCH /movements/:id aceita apenas tipos de movimentação TEMPORARY',
        );
      }
      movement.movementType = movementType;
    }
    if (dto.destinationLocation !== undefined) {
      movement.destinationLocation = dto.destinationLocation;
    }
    if (dto.reason !== undefined) {
      movement.reason = dto.reason;
    }
    if (dto.notes !== undefined) {
      movement.notes = dto.notes;
    }

    // Lock + check + save together: a return registered in the meantime must win (409), not be overwritten.
    await this.dataSource.transaction(async (manager) => {
      const current = await this.lockMovementRow(manager, id);
      if (current.returnDateTime !== null) {
        throw new ConflictException(
          'Não é possível editar uma movimentação que já possui retorno registrado',
        );
      }
      await manager.save(movement);
    });
    return MovementResponseDto.fromEntity(movement);
  }

  async returnMovement(
    id: number,
    dto: ReturnMovementDto,
    callerUnitIds: number[],
    idempotencyKey?: string,
  ): Promise<ReturnMovementResult> {
    const movement = await this.findEntityInScope(id, callerUnitIds);

    // Check + write under a lock on the movement row (FR-009): two simultaneous returns
    // serialize, so the second sees the first one instead of overwriting its return time.
    return this.dataSource.transaction(async (manager) => {
      const current = await this.lockMovementRow(manager, id);

      if (current.returnDateTime !== null) {
        // FR-009 edge case — already-returned movement MUST 409, unless this is
        // a legitimate offline retry of the exact same return (idempotency-key
        // section of contracts/movements.md, applied here the same way it's
        // applied to POST /movements).
        if (idempotencyKey && current.returnIdempotencyKey === idempotencyKey) {
          movement.returnDateTime = current.returnDateTime;
          movement.returnIdempotencyKey = current.returnIdempotencyKey;
          return { data: MovementResponseDto.fromEntity(movement), returned: false };
        }
        throw new ConflictException('Movimentação já possui retorno registrado');
      }

      movement.returnDateTime = dto.returnDateTime ? new Date(dto.returnDateTime) : new Date();
      movement.returnIdempotencyKey = idempotencyKey ?? null;
      await manager.update(
        Movement,
        { id },
        {
          returnDateTime: movement.returnDateTime,
          returnIdempotencyKey: movement.returnIdempotencyKey,
        },
      );

      return { data: MovementResponseDto.fromEntity(movement), returned: true };
    });
  }

  /** POST /api/v1/movements/final/release — contracts/movements.md (FR-012). */
  async createFinalRelease(
    dto: FinalReleaseDto,
    currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.registerFinal(
      {
        inmateId: dto.inmateId,
        movementTypeName: 'Liberdade',
        destinationLocation: 'Liberdade',
        reason: dto.reason,
        notes: dto.notes ?? null,
        exitDateTime: dto.exitDateTime,
        cellHistoryReason: CellHistoryReason.RELEASE,
        newStatus: InmateStatus.RELEASED,
      },
      currentUser,
    );
  }

  /** POST /api/v1/movements/final/ankle-monitor — contracts/movements.md (FR-013). */
  async createFinalAnkleMonitor(
    dto: FinalAnkleMonitorDto,
    currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.registerFinal(
      {
        inmateId: dto.inmateId,
        movementTypeName: 'Tornozeleira eletrônica',
        destinationLocation: 'Tornozeleira eletrônica',
        reason: dto.reason,
        notes: dto.notes ?? null,
        exitDateTime: dto.exitDateTime,
        cellHistoryReason: CellHistoryReason.ANKLE_MONITOR,
        newStatus: InmateStatus.ANKLE_MONITOR,
      },
      currentUser,
    );
  }

  /** POST /api/v1/movements/final/transfer — contracts/movements.md (FR-014). */
  async createFinalTransfer(
    dto: FinalTransferDto,
    currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.registerFinal(
      {
        inmateId: dto.inmateId,
        movementTypeName: 'Transferência',
        destinationLocation: 'Transferência',
        reason: dto.reason,
        notes: dto.notes ?? null,
        exitDateTime: dto.exitDateTime,
        cellHistoryReason: CellHistoryReason.TRANSFER,
        newStatus: InmateStatus.TRANSFERRED,
      },
      currentUser,
    );
  }

  /**
   * POST /api/v1/movements/final/reversal — contracts/movements.md (FR-016a).
   * Desfaz liberdade/tornozeleira/transferência registrada por engano sem
   * apagar nada: cria uma nova movimentação, o preso volta a ACTIVE na cela
   * escolhida (com vaga) e o registro original segue no histórico.
   */
  async createFinalReversal(
    dto: FinalReversalDto,
    currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    const inmate = await this.inmatesService.findEntityInScope(dto.inmateId, currentUser.units);
    if (inmate.status === InmateStatus.ACTIVE) {
      throw new ConflictException('Preso já está ativo — não há situação definitiva para reverter');
    }
    if (inmate.status === InmateStatus.DECEASED) {
      throw new ConflictException('Preso falecido não pode ter a situação revertida');
    }

    const destinationCell = await this.cellsService.findEntityInScope(
      dto.destinationCellId,
      currentUser.units,
    );
    if (!destinationCell.active) {
      throw new BadRequestException('Cela de destino está inativa');
    }
    return this.registerFinal(
      {
        inmateId: dto.inmateId,
        movementTypeName: 'Reversão de situação definitiva',
        destinationLocation: `Cela ${destinationCell.code}`,
        destinationCell,
        reason: dto.reason,
        notes: dto.notes ?? null,
        exitDateTime: dto.exitDateTime,
        cellHistoryReason: CellHistoryReason.REVERSAL,
        newStatus: InmateStatus.ACTIVE,
        requireVacancy: true,
        allowNonActiveInmate: true,
      },
      currentUser,
    );
  }

  /** POST /api/v1/movements/cell-change — contracts/movements.md (FR-015). */
  async createCellChange(
    dto: CellTransferDto,
    currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.registerChange(dto, currentUser, {
      sameGallery: true,
      movementTypeName: 'Troca de cela',
      cellHistoryReason: CellHistoryReason.CELL_CHANGE,
    });
  }

  /** POST /api/v1/movements/gallery-change — contracts/movements.md (FR-015b). */
  async createGalleryChange(
    dto: CellTransferDto,
    currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.registerChange(dto, currentUser, {
      sameGallery: false,
      movementTypeName: 'Troca de galeria',
      cellHistoryReason: CellHistoryReason.GALLERY_CHANGE,
    });
  }

  /** POST /api/v1/movements/cell-swap — contracts/movements.md (FR-015a). */
  async createCellSwap(
    dto: CellTransferDto,
    currentUser: JwtPayload,
  ): Promise<MovementResponseDto[]> {
    return this.registerSwap(dto, currentUser, {
      sameGallery: true,
      movementTypeName: 'Permuta de cela',
      cellHistoryReason: CellHistoryReason.CELL_SWAP,
    });
  }

  /** POST /api/v1/movements/gallery-swap — contracts/movements.md (FR-015c). */
  async createGallerySwap(
    dto: CellTransferDto,
    currentUser: JwtPayload,
  ): Promise<MovementResponseDto[]> {
    return this.registerSwap(dto, currentUser, {
      sameGallery: false,
      movementTypeName: 'Permuta de galeria',
      cellHistoryReason: CellHistoryReason.GALLERY_SWAP,
    });
  }

  /**
   * Shared core for troca de cela/galeria (single inmate, requires a vacancy
   * in the destination cell) — research.md #35, FR-015/FR-015b.
   */
  private async registerChange(
    dto: CellTransferDto,
    currentUser: JwtPayload,
    options: {
      sameGallery: boolean;
      movementTypeName: string;
      cellHistoryReason: CellHistoryReason;
    },
  ): Promise<MovementResponseDto> {
    const inmate = await this.inmatesService.findEntityInScope(dto.inmateId, currentUser.units);
    // `inmate.currentCell.gallery` is not hydrated by findEntityInScope (only
    // joined for its own WHERE filter) — re-fetch via CellsService, which
    // does eager-load gallery/unit, to compare galleries safely.
    const originCell = await this.cellsService.findEntityInScope(
      inmate.currentCell.id,
      currentUser.units,
    );
    const destinationCell = await this.cellsService.findEntityInScope(
      dto.destinationCellId,
      currentUser.units,
    );
    this.assertGalleryScope(
      originCell,
      destinationCell,
      options.sameGallery,
      options.movementTypeName,
    );

    return this.registerFinal(
      {
        inmateId: dto.inmateId,
        movementTypeName: options.movementTypeName,
        destinationLocation: `Cela ${destinationCell.code}`,
        destinationCell,
        reason: dto.reason,
        notes: dto.notes ?? null,
        exitDateTime: dto.exitDateTime,
        cellHistoryReason: options.cellHistoryReason,
        newStatus: null,
        requireVacancy: true,
      },
      currentUser,
    );
  }

  /**
   * Shared core for permuta de cela/galeria — two ACTIVE inmates trade cells
   * simultaneously, never checked against capacity (research.md #35,
   * FR-015a/FR-015c). `dto.destinationCellId` is the cell the *other* inmate
   * currently occupies; `dto.destinationInmateId` is that inmate,
   * REQUIRED — a shared cell can hold more than one ACTIVE inmate, so
   * "whoever's in that cell" is ambiguous. The client is expected to have
   * listed the cell's occupants first (`GET /inmates?cellId=&status=ACTIVE`)
   * and let the user pick which one.
   */
  private async registerSwap(
    dto: CellTransferDto,
    currentUser: JwtPayload,
    options: {
      sameGallery: boolean;
      movementTypeName: string;
      cellHistoryReason: CellHistoryReason;
    },
  ): Promise<MovementResponseDto[]> {
    const inmateA = await this.inmatesService.findEntityInScope(dto.inmateId, currentUser.units);
    this.assertInmateActive(inmateA);
    // Same reason as registerChange() — re-fetch via CellsService for a
    // gallery-hydrated Cell, since inmate.currentCell.gallery isn't loaded.
    const cellA = await this.cellsService.findEntityInScope(
      inmateA.currentCell.id,
      currentUser.units,
    );
    const cellB = await this.cellsService.findEntityInScope(
      dto.destinationCellId,
      currentUser.units,
    );
    this.assertGalleryScope(cellA, cellB, options.sameGallery, options.movementTypeName);

    if (!dto.destinationInmateId) {
      throw new BadRequestException('Informe o preso de destino da permuta (destinationInmateId)');
    }
    const inmateB = await this.inmatesService.findEntityInScope(
      dto.destinationInmateId,
      currentUser.units,
    );
    // Cobre tanto "a cela ficou vazia" quanto "esse preso específico não
    // está mais lá" (foi movido/liberado enquanto o usuário via a tela) —
    // mesmo edge case de condição de corrida de antes, agora contra o preso
    // escolhido, não "qualquer um" da cela.
    if (inmateB.status !== InmateStatus.ACTIVE || inmateB.currentCell.id !== cellB.id) {
      throw new ConflictException(
        'O preso de destino não está mais nessa cela — escolha novamente',
      );
    }

    const movementType = await this.movementTypesService.findByName(options.movementTypeName);
    const actingUser = { id: currentUser.sub } as User;

    const [movementA, movementB] = await this.dataSource.transaction(async (manager) => {
      await this.lockAndRevalidateInmates(manager, [
        {
          inmate: inmateA,
          openMovementMessage:
            'Preso possui movimentação temporária em aberto — registre o retorno antes de continuar',
        },
        {
          inmate: inmateB,
          openMovementMessage:
            'O outro preso da permuta possui movimentação temporária em aberto — registre o retorno antes de continuar',
        },
      ]);
      const savedA = await manager.save(
        manager.create(Movement, {
          inmate: inmateA,
          movementType,
          originCell: cellA,
          destinationCell: cellB,
          destinationLocation: `Cela ${cellB.code}`,
          reason: dto.reason,
          notes: dto.notes ?? null,
          exitDateTime: dto.exitDateTime ? new Date(dto.exitDateTime) : new Date(),
          returnDateTime: null,
          idempotencyKey: null,
          user: actingUser,
        }),
      );
      const savedB = await manager.save(
        manager.create(Movement, {
          inmate: inmateB,
          movementType,
          originCell: cellB,
          destinationCell: cellA,
          destinationLocation: `Cela ${cellA.code}`,
          reason: dto.reason,
          notes: dto.notes ?? null,
          exitDateTime: savedA.exitDateTime,
          returnDateTime: null,
          idempotencyKey: null,
          user: actingUser,
        }),
      );
      await manager.update(Movement, { id: savedA.id }, { pairedMovementId: savedB.id });
      await manager.update(Movement, { id: savedB.id }, { pairedMovementId: savedA.id });

      await manager.update(Inmate, { id: inmateA.id }, { currentCell: cellB });
      await manager.update(Inmate, { id: inmateB.id }, { currentCell: cellA });

      await this.cellHistoryService.closeAndMaybeOpen(
        manager,
        inmateA,
        options.cellHistoryReason,
        actingUser,
        cellB,
      );
      await this.cellHistoryService.closeAndMaybeOpen(
        manager,
        inmateB,
        options.cellHistoryReason,
        actingUser,
        cellA,
      );

      savedA.inmate = inmateA;
      savedA.movementType = movementType;
      savedA.originCell = cellA;
      savedA.destinationCell = cellB;
      savedA.user = actingUser;
      savedA.pairedMovementId = savedB.id;
      savedB.inmate = inmateB;
      savedB.movementType = movementType;
      savedB.originCell = cellB;
      savedB.destinationCell = cellA;
      savedB.user = actingUser;
      savedB.pairedMovementId = savedA.id;
      await this.recordMovementInsert(manager, savedA, currentUser.sub);
      await this.recordMovementInsert(manager, savedB, currentUser.sub);
      return [savedA, savedB];
    });

    await this.auditService.record({
      userId: currentUser.sub,
      affectedTable: 'inmates',
      recordId: inmateA.id,
      action: AuditAction.UPDATE,
      oldData: { currentCellId: cellA.id },
      newData: { currentCellId: cellB.id },
    });
    await this.auditService.record({
      userId: currentUser.sub,
      affectedTable: 'inmates',
      recordId: inmateB.id,
      action: AuditAction.UPDATE,
      oldData: { currentCellId: cellB.id },
      newData: { currentCellId: cellA.id },
    });

    return [MovementResponseDto.fromEntity(movementA), MovementResponseDto.fromEntity(movementB)];
  }

  private assertGalleryScope(
    originCell: Cell,
    destinationCell: Cell,
    sameGalleryRequired: boolean,
    movementTypeName: string,
  ): void {
    const sameGallery = originCell.gallery.id === destinationCell.gallery.id;
    if (sameGalleryRequired && !sameGallery) {
      throw new BadRequestException(
        `${movementTypeName} exige que a cela de destino esteja na mesma galeria — use a variação "de galeria" para mudar de galeria`,
      );
    }
    if (!sameGalleryRequired && sameGallery) {
      throw new BadRequestException(
        `${movementTypeName} exige que a cela de destino esteja em outra galeria — use a variação de cela para permanecer na mesma galeria`,
      );
    }
  }

  /**
   * Shared transactional core for every situação definitiva (contracts/
   * movements.md "Regras"): in one transaction, insert the `Movement` row,
   * update `inmates.status`/`currentCell`, close (and, for troca de cela,
   * open) the `inmate_cell_history` entry. Records an explicit audit entry
   * with the inmate's old/new status (contract's own wording), instead of
   * relying on the generic `AuditInterceptor` (whose `oldData` is always
   * `null`) — same precedent as `UsersService.deactivate`; controllers using
   * this MUST be `@SkipAutoAudit()` to avoid a second, less informative log.
   */
  private async registerFinal(
    input: FinalMovementInput,
    currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    const inmate = await this.inmatesService.findEntityInScope(input.inmateId, currentUser.units);
    if (!input.allowNonActiveInmate) {
      this.assertInmateActive(inmate);
    }
    const movementType = await this.movementTypesService.findByName(input.movementTypeName);
    const oldStatus = inmate.status;
    const originCell = inmate.currentCell;

    const movement = await this.dataSource.transaction(async (manager) => {
      await this.lockAndRevalidateInmates(manager, [
        {
          inmate,
          openMovementMessage:
            'Preso possui movimentação temporária em aberto — registre o retorno antes de continuar',
        },
      ]);
      if (input.requireVacancy && input.destinationCell) {
        await this.cellsService.lockAndAssertVacancy(
          manager,
          input.destinationCell,
          'Cela de destino já está na capacidade máxima',
        );
      }

      const saved = await manager.save(
        manager.create(Movement, {
          inmate,
          movementType,
          originCell,
          destinationCell: input.destinationCell ?? null,
          destinationLocation: input.destinationLocation,
          reason: input.reason,
          notes: input.notes,
          exitDateTime: input.exitDateTime ? new Date(input.exitDateTime) : new Date(),
          returnDateTime: null,
          idempotencyKey: null,
          user: { id: currentUser.sub } as User,
        }),
      );

      if (input.newStatus !== null) {
        await manager.update(Inmate, { id: inmate.id }, { status: input.newStatus });
      }
      if (input.destinationCell) {
        await manager.update(Inmate, { id: inmate.id }, { currentCell: input.destinationCell });
      }

      await this.cellHistoryService.closeAndMaybeOpen(
        manager,
        inmate,
        input.cellHistoryReason,
        { id: currentUser.sub } as User,
        input.destinationCell,
      );

      saved.inmate = inmate;
      saved.movementType = movementType;
      saved.originCell = originCell;
      saved.destinationCell = input.destinationCell ?? null;
      saved.user = { id: currentUser.sub } as User;
      await this.recordMovementInsert(manager, saved, currentUser.sub);
      return saved;
    });

    await this.auditService.record({
      userId: currentUser.sub,
      affectedTable: 'inmates',
      recordId: inmate.id,
      action: AuditAction.UPDATE,
      oldData: { status: oldStatus, currentCellId: originCell.id },
      newData: {
        status: input.newStatus ?? oldStatus,
        currentCellId: input.destinationCell?.id ?? originCell.id,
      },
    });

    return MovementResponseDto.fromEntity(movement);
  }

  /**
   * FR-026, SC-002: as rotas de situação definitiva, troca e permuta usam
   * `@SkipAutoAudit()` (o corpo delas já tem um registro mais rico do preso),
   * então o INSERT da própria movimentação, com o motivo, é auditado aqui,
   * dentro da mesma transação que a grava.
   */
  private async recordMovementInsert(
    manager: EntityManager,
    movement: Movement,
    userId: number,
  ): Promise<void> {
    await this.auditService.record(
      {
        userId,
        affectedTable: 'movements',
        recordId: movement.id,
        action: AuditAction.INSERT,
        oldData: null,
        newData: { ...MovementResponseDto.fromEntity(movement) },
      },
      manager,
    );
  }

  /** Trava a linha da movimentação e devolve o estado de retorno gravado (FR-009). */
  private async lockMovementRow(
    manager: EntityManager,
    id: number,
  ): Promise<{ returnDateTime: Date | null; returnIdempotencyKey: string | null }> {
    const row = await manager
      .getRepository(Movement)
      .createQueryBuilder('movement')
      .setLock('pessimistic_write')
      .select('movement.return_datetime', 'returnDateTime')
      .addSelect('movement.return_idempotency_key', 'returnIdempotencyKey')
      .where('movement.id = :id', { id })
      .getRawOne<{ returnDateTime: Date | null; returnIdempotencyKey: string | null }>();
    if (!row) {
      throw new NotFoundException('Movimentação não encontrada');
    }
    return row;
  }

  /** US2/US3: só preso ativo pode sair, ser liberado, transferido ou trocar de cela. */
  private assertInmateActive(inmate: Inmate): void {
    if (inmate.status !== InmateStatus.ACTIVE) {
      throw new ConflictException(
        `Preso não está ativo (situação atual: ${inmate.status}) — a operação exige preso ativo`,
      );
    }
  }

  /**
   * Primeira coisa dentro de toda transação que muda a localização de um
   * preso (Constituição IV): trava a linha de cada preso (em ordem de id, para
   * duas permutas cruzadas não travarem uma à outra), confere que status e
   * cela ainda são os que foram lidos antes da transação e que não há
   * movimentação temporária em aberto. Sem o lock, dois pedidos simultâneos
   * passariam pela mesma checagem e ambos gravariam.
   */
  private async lockAndRevalidateInmates(
    manager: EntityManager,
    targets: { inmate: Inmate; openMovementMessage: string }[],
  ): Promise<void> {
    const ordered = [...targets].sort((first, second) => first.inmate.id - second.inmate.id);
    for (const { inmate, openMovementMessage } of ordered) {
      const row = await manager
        .getRepository(Inmate)
        .createQueryBuilder('inmate')
        .setLock('pessimistic_write')
        .select('inmate.status', 'status')
        .addSelect('inmate.current_cell_id', 'currentCellId')
        .where('inmate.id = :id', { id: inmate.id })
        .getRawOne<{ status: InmateStatus; currentCellId: number | null }>();
      if (
        !row ||
        row.status !== inmate.status ||
        Number(row.currentCellId) !== inmate.currentCell.id
      ) {
        throw new ConflictException(
          'A situação ou a cela do preso mudou enquanto a operação era registrada. Tente novamente',
        );
      }
      await this.assertNoOpenTemporaryMovement(inmate.id, openMovementMessage, manager);
    }
  }

  /**
   * Blocks any change (nova movimentação temporária, troca/permuta de cela/
   * galeria, situação definitiva) enquanto o preso já está fora da cela numa
   * movimentação TEMPORARY em aberto (atendimento médico, audiência etc.) —
   * sem isso, a movimentação estrutural registraria uma cela de destino que
   * não reflete onde o preso fisicamente está. Precisa ser resolvida
   * (registrar o retorno) antes de qualquer uma dessas ações.
   */
  private async assertNoOpenTemporaryMovement(
    inmateId: number,
    message: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repository = manager ? manager.getRepository(Movement) : this.movementRepository;
    const openMovement = await repository
      .createQueryBuilder('movement')
      .innerJoin('movement.movementType', 'movementType')
      .where('movement.inmate_id = :inmateId', { inmateId })
      .andWhere('movement.return_datetime IS NULL')
      .andWhere('movementType.category = :category', { category: MovementCategory.TEMPORARY })
      .getOne();
    if (openMovement) {
      throw new ConflictException(message);
    }
  }

  private async findEntityInScope(id: number, callerUnitIds: number[]): Promise<Movement> {
    const movement = await this.movementRepository.findOne({
      where: { id },
      relations: MOVEMENT_RELATIONS,
    });
    if (!movement) {
      throw new NotFoundException('Movimentação não encontrada');
    }
    // Reuses CellsService's own scope check (throws ForbiddenException) instead
    // of re-deriving unit_id from a join here — single source of truth for
    // "is this cell in the caller's unit scope".
    await this.cellsService.findEntityInScope(movement.originCell.id, callerUnitIds);
    return movement;
  }
}
