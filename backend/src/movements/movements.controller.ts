import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { MovementsService } from './movements.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { UpdateMovementDto } from './dto/update-movement.dto';
import { ReturnMovementDto } from './dto/return-movement.dto';
import { ListMovementsQueryDto } from './dto/list-movements-query.dto';
import { MovementResponseDto } from './dto/movement-response.dto';
import { FinalReleaseDto } from './dto/final-release.dto';
import { FinalAnkleMonitorDto } from './dto/final-ankle-monitor.dto';
import { FinalReversalDto } from './dto/final-reversal.dto';
import { DefinitiveSituationsQueryDto } from './dto/definitive-situations-query.dto';
import { DefinitiveSituationResponseDto } from './dto/definitive-situation-response.dto';
import { FinalTransferDto } from './dto/final-transfer.dto';
import { CellTransferDto } from './dto/cell-transfer.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipAutoAudit } from '../common/decorators/skip-auto-audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

/** Cobre User Story 2 (FR-008…FR-011a) — contracts/movements.md. Any authenticated role may call these. */
@ApiTags('movements')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação ou recurso fora do escopo de unidade do usuário',
})
@Controller('api/v1/movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @ApiOperation({ summary: 'Lista movimentações com filtros' })
  @ApiPaginatedResponse(MovementResponseDto)
  @Get()
  list(
    @Query() query: ListMovementsQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<MovementResponseDto>> {
    return this.movementsService.list(query, currentUser.units);
  }

  @ApiOperation({
    summary:
      'Registra a saída temporária de um preso (aceita Idempotency-Key para sincronização offline)',
  })
  @Post()
  async create(
    @Body() dto: CreateMovementDto,
    @CurrentUser() currentUser: JwtPayload,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MovementResponseDto> {
    const result = await this.movementsService.create(dto, currentUser, idempotencyKey);
    res.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result.data;
  }

  @ApiOperation({ summary: 'Corrige dados de uma movimentação existente' })
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMovementDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.movementsService.update(id, dto, currentUser.units);
  }

  @ApiOperation({ summary: 'Registra o retorno de uma movimentação temporária' })
  @Patch(':id/return')
  async returnMovement(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReturnMovementDto,
    @CurrentUser() currentUser: JwtPayload,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<MovementResponseDto> {
    const result = await this.movementsService.returnMovement(
      id,
      dto,
      currentUser.units,
      idempotencyKey,
    );
    return result.data;
  }

  @ApiOperation({ summary: 'Registra a liberdade de um preso (somente Chefia/Diretor)' })
  @Post('final/release')
  @Roles(RoleName.WARDEN)
  @SkipAutoAudit() // registerFinal() already records a richer old/new status entry
  createFinalRelease(
    @Body() dto: FinalReleaseDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.movementsService.createFinalRelease(dto, currentUser);
  }

  @ApiOperation({
    summary: 'Registra a saída para tornozeleira eletrônica (somente Chefia/Diretor)',
  })
  @Post('final/ankle-monitor')
  @Roles(RoleName.WARDEN)
  @SkipAutoAudit()
  createFinalAnkleMonitor(
    @Body() dto: FinalAnkleMonitorDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.movementsService.createFinalAnkleMonitor(dto, currentUser);
  }

  @ApiOperation({
    summary: 'Registra a transferência de um preso para outra unidade (somente Chefia/Diretor)',
  })
  @Post('final/transfer')
  @Roles(RoleName.WARDEN)
  @SkipAutoAudit()
  createFinalTransfer(
    @Body() dto: FinalTransferDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.movementsService.createFinalTransfer(dto, currentUser);
  }

  @ApiOperation({
    summary:
      'Lista as situações definitivas vigentes (liberdade, tornozeleira, transferência) para consulta e reversão (somente Chefia/Diretor)',
  })
  @ApiPaginatedResponse(DefinitiveSituationResponseDto)
  @Get('definitive-situations')
  @Roles(RoleName.WARDEN)
  listDefinitiveSituations(
    @Query() query: DefinitiveSituationsQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<DefinitiveSituationResponseDto>> {
    return this.movementsService.listDefinitiveSituations(query, currentUser.units);
  }

  @ApiOperation({
    summary:
      'Reverte uma liberdade, tornozeleira ou transferência registrada por engano (somente Chefia/Diretor)',
  })
  @Post('final/reversal')
  @Roles(RoleName.WARDEN)
  @SkipAutoAudit()
  createFinalReversal(
    @Body() dto: FinalReversalDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.movementsService.createFinalReversal(dto, currentUser);
  }

  // Troca/permuta de cela/galeria (research.md #35, FR-015–FR-015c) — troca/
  // permuta de CELA disponíveis a qualquer perfil (nenhum @Roles); troca/
  // permuta de GALERIA restritas a SUPERVISOR/WARDEN.

  @ApiOperation({ summary: 'Troca o preso para outra cela com vaga na mesma galeria' })
  @Post('cell-change')
  @SkipAutoAudit() // registerChange()/registerFinal() already records a richer old/new entry
  createCellChange(
    @Body() dto: CellTransferDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.movementsService.createCellChange(dto, currentUser);
  }

  @ApiOperation({ summary: 'Permuta duas celas entre dois presos da mesma galeria' })
  @Post('cell-swap')
  @SkipAutoAudit()
  createCellSwap(
    @Body() dto: CellTransferDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto[]> {
    return this.movementsService.createCellSwap(dto, currentUser);
  }

  @ApiOperation({ summary: 'Troca o preso para uma cela com vaga em outra galeria' })
  @Post('gallery-change')
  @Roles(RoleName.SUPERVISOR, RoleName.WARDEN)
  @SkipAutoAudit()
  createGalleryChange(
    @Body() dto: CellTransferDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.movementsService.createGalleryChange(dto, currentUser);
  }

  @ApiOperation({ summary: 'Permuta de galeria entre dois presos de galerias diferentes' })
  @Post('gallery-swap')
  @Roles(RoleName.SUPERVISOR, RoleName.WARDEN)
  @SkipAutoAudit()
  createGallerySwap(
    @Body() dto: CellTransferDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto[]> {
    return this.movementsService.createGallerySwap(dto, currentUser);
  }
}
