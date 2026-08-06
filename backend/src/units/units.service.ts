import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Unit } from './entities/unit.entity';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitResponseDto } from './dto/unit-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

@Injectable()
export class UnitsService {
  constructor(@InjectRepository(Unit) private readonly unitRepository: Repository<Unit>) {}

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
    Object.assign(unit, dto);
    await this.unitRepository.save(unit);
    return UnitResponseDto.fromEntity(unit);
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
