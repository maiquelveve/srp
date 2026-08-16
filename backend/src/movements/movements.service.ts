import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movement } from './entities/movement.entity';
import { MovementCategory } from './entities/movement-type.entity';
import { MovementTypesService } from './movement-types.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { UpdateMovementDto } from './dto/update-movement.dto';
import { ReturnMovementDto } from './dto/return-movement.dto';
import { ListMovementsQueryDto } from './dto/list-movements-query.dto';
import { MovementResponseDto } from './dto/movement-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { InmatesService } from '../inmates/inmates.service';
import { CellsService } from '../cells/cells.service';
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
    private readonly movementTypesService: MovementTypesService,
    private readonly inmatesService: InmatesService,
    private readonly cellsService: CellsService,
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
