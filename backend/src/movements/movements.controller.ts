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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { MovementsService } from './movements.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { UpdateMovementDto } from './dto/update-movement.dto';
import { ReturnMovementDto } from './dto/return-movement.dto';
import { ListMovementsQueryDto } from './dto/list-movements-query.dto';
import { MovementResponseDto } from './dto/movement-response.dto';
import { FinalReleaseDto } from './dto/final-release.dto';
import { FinalAnkleMonitorDto } from './dto/final-ankle-monitor.dto';
import { FinalTransferDto } from './dto/final-transfer.dto';
import { CellTransferDto } from './dto/cell-transfer.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipAutoAudit } from '../common/decorators/skip-auto-audit.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';

/** Cobre User Story 2 (FR-008…FR-011a) — contracts/movements.md. Any authenticated role may call these. */
@ApiTags('movements')
@ApiBearerAuth()
@Controller('api/v1/movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get()
  list(
    @Query() query: ListMovementsQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<MovementResponseDto>> {
    return this.movementsService.list(query, currentUser.units);
  }

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

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMovementDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.movementsService.update(id, dto, currentUser.units);
  }

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

  @Post('final/release')
  @Roles(RoleName.WARDEN)
  @SkipAutoAudit() // registerFinal() already records a richer old/new status entry
  createFinalRelease(
    @Body() dto: FinalReleaseDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.movementsService.createFinalRelease(dto, currentUser);
  }

  @Post('final/ankle-monitor')
  @Roles(RoleName.WARDEN)
  @SkipAutoAudit()
  createFinalAnkleMonitor(
    @Body() dto: FinalAnkleMonitorDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.movementsService.createFinalAnkleMonitor(dto, currentUser);
  }

  @Post('final/transfer')
  @Roles(RoleName.WARDEN)
  @SkipAutoAudit()
  createFinalTransfer(
    @Body() dto: FinalTransferDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.movementsService.createFinalTransfer(dto, currentUser);
  }

  // Troca/permuta de cela/galeria (research.md #35, FR-015–FR-015c) — troca/
  // permuta de CELA disponíveis a qualquer perfil (nenhum @Roles); troca/
  // permuta de GALERIA restritas a SUPERVISOR/WARDEN.

  @Post('cell-change')
  @SkipAutoAudit() // registerChange()/registerFinal() already records a richer old/new entry
  createCellChange(
    @Body() dto: CellTransferDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.movementsService.createCellChange(dto, currentUser);
  }

  @Post('cell-swap')
  @SkipAutoAudit()
  createCellSwap(
    @Body() dto: CellTransferDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto[]> {
    return this.movementsService.createCellSwap(dto, currentUser);
  }

  @Post('gallery-change')
  @Roles(RoleName.SUPERVISOR, RoleName.WARDEN)
  @SkipAutoAudit()
  createGalleryChange(
    @Body() dto: CellTransferDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MovementResponseDto> {
    return this.movementsService.createGalleryChange(dto, currentUser);
  }

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
