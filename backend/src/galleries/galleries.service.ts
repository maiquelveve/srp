import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gallery } from './entities/gallery.entity';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { GalleryResponseDto } from './dto/gallery-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { UnitsService } from '../units/units.service';

@Injectable()
export class GalleriesService {
  constructor(
    @InjectRepository(Gallery) private readonly galleryRepository: Repository<Gallery>,
    private readonly unitsService: UnitsService,
  ) {}

  async listByUnit(
    unitId: number,
    callerUnitIds: number[],
  ): Promise<PaginatedResponseDto<GalleryResponseDto>> {
    await this.unitsService.findEntityInScope(unitId, callerUnitIds);
    const [galleries, total] = await this.galleryRepository.findAndCount({
      where: { unit: { id: unitId } },
      relations: { unit: true },
    });
    return new PaginatedResponseDto(
      galleries.map((g) => GalleryResponseDto.fromEntity(g)),
      total,
    );
  }

  async create(dto: CreateGalleryDto, callerUnitIds: number[]): Promise<GalleryResponseDto> {
    const unit = await this.unitsService.findEntityInScope(dto.unitId, callerUnitIds);
    const gallery = await this.galleryRepository.save(
      this.galleryRepository.create({
        unit,
        code: dto.code,
        description: dto.description ?? null,
        type: dto.type ?? null,
        active: true,
      }),
    );
    gallery.unit = unit;
    return GalleryResponseDto.fromEntity(gallery);
  }

  /** Used by CellsService to validate a galleryId is real and resolve its unit for scope checks. */
  async findEntityInScope(id: number, callerUnitIds: number[]): Promise<Gallery> {
    const gallery = await this.galleryRepository.findOne({
      where: { id },
      relations: { unit: true },
    });
    if (!gallery) {
      throw new NotFoundException('Galeria não encontrada');
    }
    if (!callerUnitIds.includes(gallery.unit.id)) {
      throw new ForbiddenException('Fora do escopo de unidade do usuário');
    }
    return gallery;
  }
}
