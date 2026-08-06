import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inmate, InmateStatus } from './entities/inmate.entity';
import { Movement } from '../movements/entities/movement.entity';
import { MovementCategory } from '../movements/entities/movement-type.entity';
import { CreateInmateDto } from './dto/create-inmate.dto';
import { UpdateInmateDto } from './dto/update-inmate.dto';
import { ListInmatesQueryDto } from './dto/list-inmates-query.dto';
import { InmateResponseDto } from './dto/inmate-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CellsService } from '../cells/cells.service';

@Injectable()
export class InmatesService {
  constructor(
    @InjectRepository(Inmate) private readonly inmateRepository: Repository<Inmate>,
    @InjectRepository(Movement) private readonly movementRepository: Repository<Movement>,
    private readonly cellsService: CellsService,
  ) {}

  async list(
    query: ListInmatesQueryDto,
    callerUnitIds: number[],
  ): Promise<PaginatedResponseDto<InmateResponseDto>> {
    if (callerUnitIds.length === 0) {
      return new PaginatedResponseDto([], 0);
    }

    const qb = this.inmateRepository
      .createQueryBuilder('inmate')
      .leftJoinAndSelect('inmate.currentCell', 'cell')
      .leftJoin('cell.gallery', 'gallery')
      .where('gallery.unit_id IN (:...callerUnitIds)', { callerUnitIds });

    if (query.galleryId) {
      qb.andWhere('gallery.id = :galleryId', { galleryId: query.galleryId });
    }
    if (query.cellId) {
      qb.andWhere('cell.id = :cellId', { cellId: query.cellId });
    }
    if (query.status) {
      qb.andWhere('inmate.status = :status', { status: query.status });
    }

    const [inmates, total] = await qb.getManyAndCount();
    const openMovementInmateIds = await this.openMovementInmateIds(inmates.map((i) => i.id));

    return new PaginatedResponseDto(
      inmates.map((i) => InmateResponseDto.fromEntity(i, openMovementInmateIds.has(i.id))),
      total,
    );
  }

  async findById(id: number, callerUnitIds: number[]): Promise<InmateResponseDto> {
    const inmate = await this.findEntityInScope(id, callerUnitIds);
    const openMovementInmateIds = await this.openMovementInmateIds([inmate.id]);
    return InmateResponseDto.fromEntity(inmate, openMovementInmateIds.has(inmate.id));
  }

  async create(dto: CreateInmateDto, callerUnitIds: number[]): Promise<InmateResponseDto> {
    const cell = await this.cellsService.findEntityInScope(dto.currentCellId, callerUnitIds);

    const occupancy = await this.cellsService.occupancyOf(cell.id);
    if (occupancy >= cell.capacity) {
      throw new BadRequestException('Cela já está na capacidade máxima');
    }

    const inmate = await this.inmateRepository.save(
      this.inmateRepository.create({
        name: dto.name,
        registrationId: dto.registrationId ?? null,
        birthDate: dto.birthDate ?? null,
        custodyRegime: dto.custodyRegime ?? null,
        photoUrl: dto.photoUrl ?? null,
        status: InmateStatus.ACTIVE,
        currentCell: cell,
      }),
    );
    inmate.currentCell = cell;
    return InmateResponseDto.fromEntity(inmate, false);
  }

  async update(
    id: number,
    dto: UpdateInmateDto,
    callerUnitIds: number[],
  ): Promise<InmateResponseDto> {
    const inmate = await this.findEntityInScope(id, callerUnitIds);
    Object.assign(inmate, dto);
    await this.inmateRepository.save(inmate);
    const openMovementInmateIds = await this.openMovementInmateIds([inmate.id]);
    return InmateResponseDto.fromEntity(inmate, openMovementInmateIds.has(inmate.id));
  }

  private async findEntityInScope(id: number, callerUnitIds: number[]): Promise<Inmate> {
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

  /**
   * "Em movimentação" only applies to open TEMPORARY movements — a PERMANENT
   * movement (situação definitiva, US3) also leaves returnDateTime null
   * forever, but that is not "em trânsito", it is a terminal state.
   */
  private async openMovementInmateIds(inmateIds: number[]): Promise<Set<number>> {
    if (inmateIds.length === 0) {
      return new Set();
    }
    const openMovements = await this.movementRepository
      .createQueryBuilder('movement')
      .innerJoin('movement.movementType', 'movementType')
      .where('movement.inmate_id IN (:...inmateIds)', { inmateIds })
      .andWhere('movement.return_datetime IS NULL')
      .andWhere('movementType.category = :category', { category: MovementCategory.TEMPORARY })
      .select('movement.inmate_id', 'inmateId')
      .getRawMany<{ inmateId: number }>();
    return new Set(openMovements.map((m) => m.inmateId));
  }
}
