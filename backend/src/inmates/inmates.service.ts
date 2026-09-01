import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Inmate, InmateStatus } from './entities/inmate.entity';
import { InmateCellHistory } from './entities/inmate-cell-history.entity';
import { Movement } from '../movements/entities/movement.entity';
import { MovementCategory } from '../movements/entities/movement-type.entity';
import { CreateInmateDto } from './dto/create-inmate.dto';
import { UpdateInmateDto } from './dto/update-inmate.dto';
import { ListInmatesQueryDto } from './dto/list-inmates-query.dto';
import { InmateResponseDto, OpenMovementInfo } from './dto/inmate-response.dto';
import { LocationHistoryEntryDto } from './dto/location-history-entry.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CellsService } from '../cells/cells.service';
import { CellHistoryService } from './cell-history.service';

@Injectable()
export class InmatesService {
  constructor(
    @InjectRepository(Inmate) private readonly inmateRepository: Repository<Inmate>,
    @InjectRepository(InmateCellHistory)
    private readonly cellHistoryRepository: Repository<InmateCellHistory>,
    @InjectRepository(Movement) private readonly movementRepository: Repository<Movement>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cellsService: CellsService,
    private readonly cellHistoryService: CellHistoryService,
  ) {}

  async list(
    query: ListInmatesQueryDto,
    callerUnitIds: number[],
  ): Promise<PaginatedResponseDto<InmateResponseDto>> {
    if (callerUnitIds.length === 0) {
      return new PaginatedResponseDto([], 0);
    }

    const inmatesQuery = this.inmateRepository
      .createQueryBuilder('inmate')
      .leftJoinAndSelect('inmate.currentCell', 'cell')
      .leftJoin('cell.gallery', 'gallery')
      .where('gallery.unit_id IN (:...callerUnitIds)', { callerUnitIds });

    if (query.unitId) {
      inmatesQuery.andWhere('gallery.unit_id = :unitId', { unitId: query.unitId });
    }
    if (query.galleryId) {
      inmatesQuery.andWhere('gallery.id = :galleryId', { galleryId: query.galleryId });
    }
    if (query.cellId) {
      inmatesQuery.andWhere('cell.id = :cellId', { cellId: query.cellId });
    }
    if (query.status) {
      inmatesQuery.andWhere('inmate.status = :status', { status: query.status });
    }

    const [inmates, total] = await inmatesQuery.getManyAndCount();
    const openMovementByInmateId = await this.openMovementByInmateId(inmates.map((i) => i.id));

    return new PaginatedResponseDto(
      inmates.map((i) => InmateResponseDto.fromEntity(i, openMovementByInmateId.get(i.id) ?? null)),
      total,
    );
  }

  async findById(id: number, callerUnitIds: number[]): Promise<InmateResponseDto> {
    const inmate = await this.findEntityInScope(id, callerUnitIds);
    const openMovementByInmateId = await this.openMovementByInmateId([inmate.id]);
    return InmateResponseDto.fromEntity(inmate, openMovementByInmateId.get(inmate.id) ?? null);
  }

  async create(dto: CreateInmateDto, callerUnitIds: number[]): Promise<InmateResponseDto> {
    const cell = await this.cellsService.findEntityInScope(dto.currentCellId, callerUnitIds);

    const occupancy = await this.cellsService.occupancyOf(cell.id);
    if (occupancy >= cell.capacity) {
      throw new BadRequestException('Cela já está na capacidade máxima');
    }

    const inmate = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(Inmate, {
          name: dto.name,
          registrationId: dto.registrationId ?? null,
          birthDate: dto.birthDate ?? null,
          custodyRegime: dto.custodyRegime ?? null,
          photoUrl: dto.photoUrl ?? null,
          status: InmateStatus.ACTIVE,
          currentCell: cell,
        }),
      );
      created.currentCell = cell;
      // Opens the first location-history entry (FR-016) — without this, a
      // final/* situação definitiva would have no open entry to close.
      await this.cellHistoryService.openInitialEntry(manager, created, cell);
      return created;
    });

    return InmateResponseDto.fromEntity(inmate, null);
  }

  async update(
    id: number,
    dto: UpdateInmateDto,
    callerUnitIds: number[],
  ): Promise<InmateResponseDto> {
    const inmate = await this.findEntityInScope(id, callerUnitIds);
    Object.assign(inmate, dto);
    await this.inmateRepository.save(inmate);
    const openMovementByInmateId = await this.openMovementByInmateId([inmate.id]);
    return InmateResponseDto.fromEntity(inmate, openMovementByInmateId.get(inmate.id) ?? null);
  }

  /** Used by MovementsService to validate an inmateId is real and resolve scope (T038). */
  async findEntityInScope(id: number, callerUnitIds: number[]): Promise<Inmate> {
    const inmate = await this.inmateRepository
      .createQueryBuilder('inmate')
      .leftJoinAndSelect('inmate.currentCell', 'cell')
      .leftJoin('cell.gallery', 'gallery')
      .where('inmate.id = :id', { id })
      .andWhere('gallery.unit_id IN (:...callerUnitIds)', { callerUnitIds })
      .getOne();

    if (!inmate) {
      throw new NotFoundException('Preso não encontrado');
    }
    return inmate;
  }

  /** GET /api/v1/inmates/:id/location-history — contracts/movements.md (FR-016). */
  async locationHistory(id: number, callerUnitIds: number[]): Promise<LocationHistoryEntryDto[]> {
    await this.findEntityInScope(id, callerUnitIds);
    const entries = await this.cellHistoryRepository.find({
      where: { inmate: { id } },
      relations: { cell: { gallery: { unit: true } } },
      order: { entryDate: 'ASC' },
    });
    return entries.map((entry) => LocationHistoryEntryDto.fromEntity(entry));
  }

  /**
   * "Em movimentação" only applies to open TEMPORARY movements — a PERMANENT
   * movement (situação definitiva, US3) also leaves returnDateTime null
   * forever, but that is not "em trânsito", it is a terminal state. Read live
   * off `movements` on every request rather than a stored flag on `Inmate` —
   * the movement's own create/return timestamps are already the single
   * source of truth for "is this inmate currently out" (FR-011), so a
   * derived read avoids a second place that could drift out of sync.
   */
  private async openMovementByInmateId(
    inmateIds: number[],
  ): Promise<Map<number, OpenMovementInfo>> {
    if (inmateIds.length === 0) {
      return new Map();
    }
    const openMovements = await this.movementRepository
      .createQueryBuilder('movement')
      .innerJoin('movement.movementType', 'movementType')
      .where('movement.inmate_id IN (:...inmateIds)', { inmateIds })
      .andWhere('movement.return_datetime IS NULL')
      .andWhere('movementType.category = :category', { category: MovementCategory.TEMPORARY })
      .select('movement.id', 'movementId')
      .addSelect('movement.inmate_id', 'inmateId')
      .addSelect('movementType.name', 'movementTypeName')
      .addSelect('movement.exit_datetime', 'exitDateTime')
      .getRawMany<{
        movementId: number;
        inmateId: number;
        movementTypeName: string;
        exitDateTime: Date;
      }>();
    return new Map(
      openMovements.map((m) => [
        m.inmateId,
        {
          movementId: m.movementId,
          movementTypeName: m.movementTypeName,
          exitDateTime: m.exitDateTime,
        },
      ]),
    );
  }
}
