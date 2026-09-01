import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
    const openMovement = await this.movementRepository
      .createQueryBuilder('movement')
      .innerJoin('movement.movementType', 'movementType')
      .where('movement.inmate_id = :inmateId', { inmateId: inmate.id })
      .andWhere('movement.return_datetime IS NULL')
      .andWhere('movementType.category = :category', { category: MovementCategory.TEMPORARY })
      .getOne();
    if (openMovement) {
      throw new ConflictException('Preso já possui movimentação em aberto');
    }

    const movement = await this.movementRepository.save(
      this.movementRepository.create({
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
    movement.inmate = inmate;
    movement.movementType = movementType;
    movement.originCell = originCell;
    movement.user = { id: currentUser.sub } as User;

    return { data: MovementResponseDto.fromEntity(movement), created: true };
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

    if (movement.returnDateTime !== null) {
      throw new ConflictException(
        'Não é possível editar uma movimentação que já possui retorno registrado',
      );
    }

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

    await this.movementRepository.save(movement);
    return MovementResponseDto.fromEntity(movement);
  }

  async returnMovement(
    id: number,
    dto: ReturnMovementDto,
    callerUnitIds: number[],
    idempotencyKey?: string,
  ): Promise<ReturnMovementResult> {
    const movement = await this.findEntityInScope(id, callerUnitIds);

    if (movement.returnDateTime !== null) {
      // FR-009 edge case — already-returned movement MUST 409, unless this is
      // a legitimate offline retry of the exact same return (idempotency-key
      // section of contracts/movements.md, applied here the same way it's
      // applied to POST /movements).
      if (idempotencyKey && movement.returnIdempotencyKey === idempotencyKey) {
        return { data: MovementResponseDto.fromEntity(movement), returned: false };
      }
      throw new ConflictException('Movimentação já possui retorno registrado');
    }

    movement.returnDateTime = dto.returnDateTime ? new Date(dto.returnDateTime) : new Date();
    movement.returnIdempotencyKey = idempotencyKey ?? null;
    await this.movementRepository.save(movement);

    return { data: MovementResponseDto.fromEntity(movement), returned: true };
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

    const occupancy = await this.cellsService.occupancyOf(destinationCell.id);
    if (occupancy >= destinationCell.capacity) {
      throw new BadRequestException('Cela de destino já está na capacidade máxima');
    }

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
      },
      currentUser,
    );
  }

  /**
   * Shared core for permuta de cela/galeria — two ACTIVE inmates trade cells
   * simultaneously, never checked against capacity (research.md #35,
   * FR-015a/FR-015c). `dto.destinationCellId` is the cell the *other* inmate
   * currently occupies (the client is expected to have confirmed this via
   * `GET /cells/:id/occupant` first).
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

    const inmateB = await this.cellsService.findActiveOccupant(cellB.id);
    if (!inmateB) {
      throw new ConflictException('A cela de destino não está mais ocupada — escolha novamente');
    }

    const movementType = await this.movementTypesService.findByName(options.movementTypeName);
    const actingUser = { id: currentUser.sub } as User;

    const [movementA, movementB] = await this.dataSource.transaction(async (manager) => {
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
    const movementType = await this.movementTypesService.findByName(input.movementTypeName);
    const oldStatus = inmate.status;
    const originCell = inmate.currentCell;

    const movement = await this.dataSource.transaction(async (manager) => {
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
