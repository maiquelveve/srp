import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cell } from './entities/cell.entity';
import { Inmate, InmateStatus } from '../inmates/entities/inmate.entity';
import { CreateCellDto } from './dto/create-cell.dto';
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
      throw new BadRequestException('capacity deve ser >= 0');
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
}
