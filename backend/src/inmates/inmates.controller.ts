import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InmatesService } from './inmates.service';
import { CreateInmateDto } from './dto/create-inmate.dto';
import { UpdateInmateDto } from './dto/update-inmate.dto';
import { ListInmatesQueryDto } from './dto/list-inmates-query.dto';
import { InmateResponseDto } from './dto/inmate-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';

/** Cobre User Story 1 (FR-006/FR-007) — contracts/structure.md. */
@ApiTags('inmates')
@ApiBearerAuth()
@Controller('api/v1/inmates')
export class InmatesController {
  constructor(private readonly inmatesService: InmatesService) {}

  @Get()
  list(
    @Query() query: ListInmatesQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<InmateResponseDto>> {
    return this.inmatesService.list(query, currentUser.units);
  }

  @Get(':id')
  findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<InmateResponseDto> {
    return this.inmatesService.findById(id, currentUser.units);
  }

  @Post()
  @Roles(RoleName.WARDEN)
  create(
    @Body() dto: CreateInmateDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<InmateResponseDto> {
    return this.inmatesService.create(dto, currentUser.units);
  }

  @Patch(':id')
  @Roles(RoleName.WARDEN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInmateDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<InmateResponseDto> {
    return this.inmatesService.update(id, dto, currentUser.units);
  }
}
