import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cell } from './entities/cell.entity';
import { Inmate, InmateStatus } from '../inmates/entities/inmate.entity';
import { countActiveInmatesInScope } from '../inmates/helpers';
import { CreateCellDto } from './dto/create-cell.dto';
import { UpdateCellDto } from './dto/update-cell.dto';
import { CellResponseDto } from './dto/cell-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { GalleriesService } from '../galleries/galleries.service';

@Injectable()
export class CellsService {
  constructor(
    @InjectRepository(Cell) private readonly cellRepository: Repository<Cell>,
    @InjectRepository(Inmate) private readonly inmateRepository: Repository<Inmate>,
    private readonly galleriesService: GalleriesService,
  ) {}

  async listByGallery(
    galleryId: number,
    callerUnitIds: number[],
  ): Promise<PaginatedResponseDto<CellResponseDto>> {
    await this.galleriesService.findEntityInScope(galleryId, callerUnitIds);
    const [cells, total] = await this.cellRepository.findAndCount({
      where: { gallery: { id: galleryId } },
      relations: { gallery: true },
    });
    const withOccupancy = await Promise.all(
      cells.map(async (cell) => CellResponseDto.fromEntity(cell, await this.occupancyOf(cell.id))),
    );
    return new PaginatedResponseDto(withOccupancy, total);
  }

  async create(dto: CreateCellDto, callerUnitIds: number[]): Promise<CellResponseDto> {
    // Defense in depth — the DTO's @Min(0) already rejects this at the HTTP layer,
    // but the service must not trust the transport layer alone (Constitution IV).
    if (dto.capacity < 0) {
      throw new BadRequestException('capacidade deve ser maior que 0');
    }

    const gallery = await this.galleriesService.findEntityInScope(dto.galleryId, callerUnitIds);
    const cell = await this.cellRepository.save(
      this.cellRepository.create({
        gallery,
        code: dto.code,
        capacity: dto.capacity,
        type: dto.type,
        active: true,
      }),
    );
    cell.gallery = gallery;
    return CellResponseDto.fromEntity(cell, 0);
  }

  async update(id: number, dto: UpdateCellDto, callerUnitIds: number[]): Promise<CellResponseDto> {
    // Same defense-in-depth reasoning as create() — @Min(0) already rejects
    // this at the HTTP layer, but the service must not trust it alone.
    if (dto.capacity !== undefined && dto.capacity < 0) {
      throw new BadRequestException('capacity deve ser >= 0');
    }

    const cell = await this.findEntityInScope(id, callerUnitIds);
    const isDeactivating = dto.active === false && cell.active;
    const isReactivating = dto.active === true && !cell.active;

    // A Cela can never be ACTIVE while its Galeria or Unidade is INATIVA —
    // `gallery`/`gallery.unit` are already loaded by `findEntityInScope`, no
    // extra query needed. Checked closest-ancestor-first so the message
    // points at whichever one actually needs reactivating.
    if (isReactivating) {
      if (!cell.gallery.active) {
        throw new ConflictException(
          'Não é possível reativar: a galeria desta cela está inativa. Reative a galeria antes de reativar esta cela.',
        );
      }
      if (!cell.gallery.unit.active) {
        throw new ConflictException(
          'Não é possível reativar: a unidade desta cela está inativa. Reative a unidade antes de reativar esta cela.',
        );
      }
    }

    if (isDeactivating) {
      const activeOccupancy = await countActiveInmatesInScope(this.inmateRepository.manager, {
        level: 'cell',
        cellId: id,
      });
      if (activeOccupancy > 0) {
        throw new ConflictException(
          'Não é possível desativar: existem presos ativos nesta cela. Mova-os ou registre a situação definitiva antes de desativar.',
        );
      }
    }

    Object.assign(cell, dto);
    await this.cellRepository.save(cell);
    return CellResponseDto.fromEntity(cell, await this.occupancyOf(cell.id));
  }

  /** Used by InmatesService to validate a cellId is real, resolve its unit for scope, and check capacity. */
  async findEntityInScope(id: number, callerUnitIds: number[]): Promise<Cell> {
    const cell = await this.cellRepository.findOne({
      where: { id },
      relations: { gallery: { unit: true } },
    });
    if (!cell) {
      throw new NotFoundException('Cela não encontrada');
    }
    if (!callerUnitIds.includes(cell.gallery.unit.id)) {
      throw new ForbiddenException('Fora do escopo de unidade do usuário');
    }
    return cell;
  }

  async occupancyOf(cellId: number): Promise<number> {
    return this.inmateRepository.count({
      where: { currentCell: { id: cellId }, status: InmateStatus.ACTIVE },
    });
  }

  /** Used by GET /cells/:id/occupant and by permuta validation (research.md #35, FR-015a/FR-015c). */
  async findActiveOccupant(cellId: number): Promise<Inmate | null> {
    return this.inmateRepository.findOne({
      where: { currentCell: { id: cellId }, status: InmateStatus.ACTIVE },
    });
  }
}
