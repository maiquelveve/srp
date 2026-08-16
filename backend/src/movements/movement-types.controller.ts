import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MovementTypesService } from './movement-types.service';
import { MovementType } from './entities/movement-type.entity';

/**
 * Reference-data endpoint (not itself in contracts/movements.md's table, added
 * so the web/mobile "registrar movimentação" forms can populate a type picker
 * instead of hardcoding movement type ids/names) — read-only, any authenticated user.
 */
@ApiTags('movements')
@ApiBearerAuth()
@Controller('api/v1/movement-types')
export class MovementTypesController {
  constructor(private readonly movementTypesService: MovementTypesService) {}

  @Get()
  list(): Promise<MovementType[]> {
    return this.movementTypesService.list();
  }
}
