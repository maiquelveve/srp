import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CellsService } from './cells.service';
import { CreateCellDto } from './dto/create-cell.dto';
import { UpdateCellDto } from './dto/update-cell.dto';
import { CellResponseDto } from './dto/cell-response.dto';
import { CellOccupantResponseDto } from './dto/cell-occupant-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';

@ApiTags('cells')
@ApiBearerAuth()
@Controller('api/v1/cells')
export class CellsController {
  constructor(private readonly cellsService: CellsService) {}

  @Post()
  @Roles(RoleName.WARDEN)
  create(
    @Body() dto: CreateCellDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<CellResponseDto> {
    return this.cellsService.create(dto, currentUser.units);
  }

  @Patch(':id')
  @Roles(RoleName.WARDEN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCellDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<CellResponseDto> {
    return this.cellsService.update(id, dto, currentUser.units);
  }

  /**
   * contracts/movements.md (FR-015a/FR-015c) — used by the permuta flow to
   * show who occupies the chosen destination cell before confirming.
   * Serializes the body manually (`res.json`) — Nest sends an EMPTY body
   * (not the JSON literal `null`) when a handler simply `return`s `null`.
   */
  @Get(':id/occupant')
  async occupant(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    await this.cellsService.findEntityInScope(id, currentUser.units);
    const occupant = await this.cellsService.findActiveOccupant(id);
    res.json(occupant ? CellOccupantResponseDto.fromEntity(occupant) : null);
  }
}
