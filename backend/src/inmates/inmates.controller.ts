import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { InmatesService } from './inmates.service';
import { CreateInmateDto } from './dto/create-inmate.dto';
import { UpdateInmateDto } from './dto/update-inmate.dto';
import { ListInmatesQueryDto } from './dto/list-inmates-query.dto';
import { InmateResponseDto } from './dto/inmate-response.dto';
import { LocationHistoryEntryDto } from './dto/location-history-entry.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

/** Cobre User Story 1 (FR-006/FR-007) — contracts/structure.md. */
@ApiTags('inmates')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação ou recurso fora do escopo de unidade do usuário',
})
@Controller('api/v1/inmates')
export class InmatesController {
  constructor(private readonly inmatesService: InmatesService) {}

  @ApiPaginatedResponse(InmateResponseDto)
  @ApiOperation({
    summary: 'Lista presos por unidade, galeria, cela ou situação, com o status em tempo real',
  })
  @Get()
  list(
    @Query() query: ListInmatesQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<InmateResponseDto>> {
    return this.inmatesService.list(query, currentUser.units);
  }

  @ApiOperation({ summary: 'Detalha um preso, incluindo a movimentação em aberto' })
  @Get(':id')
  findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<InmateResponseDto> {
    return this.inmatesService.findById(id, currentUser.units);
  }

  @ApiOperation({ summary: 'Cadastra um preso em uma cela' })
  @Post()
  @Roles(RoleName.WARDEN)
  create(
    @Body() dto: CreateInmateDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<InmateResponseDto> {
    return this.inmatesService.create(dto, currentUser.units);
  }

  @ApiOperation({ summary: 'Altera dados cadastrais de um preso' })
  @Patch(':id')
  @Roles(RoleName.WARDEN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInmateDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<InmateResponseDto> {
    return this.inmatesService.update(id, dto, currentUser.units);
  }

  @ApiOperation({
    summary: 'Histórico de localização do preso (celas, unidades e situações definitivas)',
  })
  @Get(':id/location-history')
  locationHistory(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<LocationHistoryEntryDto[]> {
    return this.inmatesService.locationHistory(id, currentUser.units);
  }
}
