import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitResponseDto } from './dto/unit-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';

/** Cobre User Story 1 — Cadastro e Mapa da Unidade (FR-005…FR-007), contracts/structure.md. */
@ApiTags('units')
@ApiBearerAuth()
@Controller('api/v1/units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  list(@CurrentUser() currentUser: JwtPayload): Promise<PaginatedResponseDto<UnitResponseDto>> {
    return this.unitsService.list(currentUser.units);
  }

  @Post()
  @Roles(RoleName.WARDEN)
  create(@Body() dto: CreateUnitDto): Promise<UnitResponseDto> {
    return this.unitsService.create(dto);
  }

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
