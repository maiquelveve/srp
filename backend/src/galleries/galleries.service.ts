import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Gallery } from './entities/gallery.entity';
import { Cell } from '../cells/entities/cell.entity';
import { countActiveInmatesInScope } from '../inmates/helpers';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { GalleryResponseDto } from './dto/gallery-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { UnitsService } from '../units/units.service';

@Injectable()
export class GalleriesService {
  constructor(
    @InjectRepository(Gallery) private readonly galleryRepository: Repository<Gallery>,
    private readonly unitsService: UnitsService,
    @InjectDataSource() private readonly dataSource: DataSource,
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
        type: dto.type,
        active: true,
      }),
    );
    gallery.unit = unit;
    return GalleryResponseDto.fromEntity(gallery);
  }

  async update(
    id: number,
    dto: UpdateGalleryDto,
    callerUnitIds: number[],
  ): Promise<GalleryResponseDto> {
    const gallery = await this.findEntityInScope(id, callerUnitIds);
    const isDeactivating = dto.active === false && gallery.active;
    const isReactivating = dto.active === true && !gallery.active;

    // A Galeria can never be ACTIVE while its own Unidade is INATIVA — that
    // would leave an inconsistent state impossible to reach the other way
    // around (deactivating a Unidade always cascades its Galerias). `unit`
    // is already loaded by `findEntityInScope`, no extra query needed.
    if (isReactivating && !gallery.unit.active) {
      throw new ConflictException(
        'Não é possível reativar: a unidade desta galeria está inativa. Reative a unidade antes de reativar esta galeria.',
      );
    }

    if (!isDeactivating) {
      Object.assign(gallery, dto);
      await this.galleryRepository.save(gallery);
      return GalleryResponseDto.fromEntity(gallery);
    }

    await this.dataSource.transaction(async (manager) => {
      const activeInmateCount = await countActiveInmatesInScope(manager, {
        level: 'gallery',
        galleryId: id,
      });

      if (activeInmateCount > 0) {
        throw new ConflictException(
          'Não é possível desativar: existem presos ativos nesta galeria. Mova-os ou registre a situação definitiva antes de desativar.',
        );
      }

      await manager.update(Cell, { gallery: { id } }, { active: false });
      await manager.update(Gallery, { id }, dto);
    });

    return GalleryResponseDto.fromEntity(await this.findEntityInScope(id, callerUnitIds));
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
