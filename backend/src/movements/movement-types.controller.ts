import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { MovementTypesService } from './movement-types.service';
import { MovementType } from './entities/movement-type.entity';

/**
 * Reference-data endpoint (not itself in contracts/movements.md's table, added
 * so the web/mobile "registrar movimentação" forms can populate a type picker
 * instead of hardcoding movement type ids/names) — read-only, any authenticated user.
 */
@ApiTags('movements')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação ou recurso fora do escopo de unidade do usuário',
})
@Controller('api/v1/movement-types')
export class MovementTypesController {
  constructor(private readonly movementTypesService: MovementTypesService) {}

  @ApiOperation({ summary: 'Lista os tipos de movimentação disponíveis' })
  @Get()
  list(): Promise<MovementType[]> {
    return this.movementTypesService.list();
  }
}
