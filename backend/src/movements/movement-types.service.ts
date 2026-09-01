import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MovementType } from './entities/movement-type.entity';

/** Reference-data access for Movement Types — seeded, never created via the API (research.md). */
@Injectable()
export class MovementTypesService {
  constructor(
    @InjectRepository(MovementType)
    private readonly movementTypeRepository: Repository<MovementType>,
  ) {}

  async list(): Promise<MovementType[]> {
    return this.movementTypeRepository.find({ order: { name: 'ASC' } });
  }

  async findById(id: number): Promise<MovementType> {
    const movementType = await this.movementTypeRepository.findOne({ where: { id } });
    if (!movementType) {
      throw new NotFoundException('Tipo de movimentação não encontrado');
    }
    return movementType;
  }

  /** Used by the `final/*` situação-definitiva endpoints — one fixed, seeded type per endpoint. */
  async findByName(name: string): Promise<MovementType> {
    const movementType = await this.movementTypeRepository.findOne({ where: { name } });
    if (!movementType) {
      throw new NotFoundException(`Tipo de movimentação "${name}" não encontrado`);
    }
    return movementType;
  }
}
