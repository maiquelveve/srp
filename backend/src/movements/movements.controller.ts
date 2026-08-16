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
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
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
}
