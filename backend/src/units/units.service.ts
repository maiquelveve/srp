import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Unit } from './entities/unit.entity';
import { Gallery } from '../galleries/entities/gallery.entity';
import { Cell } from '../cells/entities/cell.entity';
import { countActiveInmatesInScope } from '../inmates/helpers';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitResponseDto } from './dto/unit-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(Unit) private readonly unitRepository: Repository<Unit>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Listings are always scoped to the caller's linked units (FR-004a). */
  async list(callerUnitIds: number[]): Promise<PaginatedResponseDto<UnitResponseDto>> {
    if (callerUnitIds.length === 0) {
      return new PaginatedResponseDto([], 0);
    }
    const [units, total] = await this.unitRepository.findAndCount({
      where: { id: In(callerUnitIds) },
    });
    return new PaginatedResponseDto(
      units.map((u) => UnitResponseDto.fromEntity(u)),
      total,
    );
  }

  async create(dto: CreateUnitDto): Promise<UnitResponseDto> {
    const unit = await this.unitRepository.save(
      this.unitRepository.create({ ...dto, active: true }),
    );
    return UnitResponseDto.fromEntity(unit);
  }

  async update(id: number, dto: UpdateUnitDto, callerUnitIds: number[]): Promise<UnitResponseDto> {
    const unit = await this.findEntityInScope(id, callerUnitIds);
    const isDeactivating = dto.active === false && unit.active;

    if (!isDeactivating) {
      Object.assign(unit, dto);
      await this.unitRepository.save(unit);
      return UnitResponseDto.fromEntity(unit);
    }

    await this.dataSource.transaction(async (manager) => {
      const activeInmateCount = await countActiveInmatesInScope(manager, {
        level: 'unit',
        unitId: id,
      });

      if (activeInmateCount > 0) {
        throw new ConflictException(
          'Não é possível desativar: existem presos ativos nesta unidade. Mova-os ou registre a situação definitiva antes de desativar.',
        );
      }

      const galleries = await manager.find(Gallery, { where: { unit: { id } } });
      const galleryIds = galleries.map((g) => g.id);
      if (galleryIds.length > 0) {
        await manager.update(Cell, { gallery: { id: In(galleryIds) } }, { active: false });
        await manager.update(Gallery, { id: In(galleryIds) }, { active: false });
      }
      await manager.update(Unit, { id }, dto);
    });

    return UnitResponseDto.fromEntity(await this.findEntityInScope(id, callerUnitIds));
  }

  /**
   * Unit ids a listing or report should cover: an explicit `unitId` must be in the
   * caller's scope; otherwise it falls back to all of the caller's units (FR-004a).
   */
  async resolveScope(
    requestedUnitId: number | undefined,
    callerUnitIds: number[],
  ): Promise<number[]> {
    if (requestedUnitId === undefined) {
      return callerUnitIds;
    }
    const unit = await this.findEntityInScope(requestedUnitId, callerUnitIds);
    return [unit.id];
  }

  /** Used by other modules (Galleries) to validate a unitId is real and in scope. */
  async findEntityInScope(id: number, callerUnitIds: number[]): Promise<Unit> {
    const unit = await this.unitRepository.findOne({ where: { id } });
    if (!unit) {
      throw new NotFoundException('Unidade não encontrada');
    }
    if (!callerUnitIds.includes(id)) {
      throw new ForbiddenException('Fora do escopo de unidade do usuário');
    }
    return unit;
  }
}
