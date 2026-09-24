import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitResponseDto } from './dto/unit-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

/** Cobre User Story 1 — Cadastro e Mapa da Unidade (FR-005…FR-007), contracts/structure.md. */
@ApiTags('units')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação ou recurso fora do escopo de unidade do usuário',
})
@Controller('api/v1/units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @ApiOperation({ summary: 'Lista as unidades do escopo do usuário' })
  @ApiPaginatedResponse(UnitResponseDto)
  @Get()
  list(@CurrentUser() currentUser: JwtPayload): Promise<PaginatedResponseDto<UnitResponseDto>> {
    return this.unitsService.list(currentUser.units);
  }

  @ApiOperation({ summary: 'Cadastra uma unidade (somente Chefia/Diretor)' })
  @Post()
  @Roles(RoleName.WARDEN)
  create(@Body() dto: CreateUnitDto): Promise<UnitResponseDto> {
    return this.unitsService.create(dto);
  }

  @ApiOperation({ summary: 'Altera dados de uma unidade ou a desativa/reativa' })
  @Patch(':id')
  @Roles(RoleName.WARDEN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUnitDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<UnitResponseDto> {
    return this.unitsService.update(id, dto, currentUser.units);
  }
}
