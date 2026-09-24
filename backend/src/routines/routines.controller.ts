import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RoutinesService } from './routines.service';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { UpdateRoutineScheduleDto } from './dto/update-routine-schedule.dto';
import { UpdateRoutineActivationDto } from './dto/update-routine-activation.dto';
import { ListRoutinesQueryDto } from './dto/list-routines-query.dto';
import { RoutineResponseDto } from './dto/routine-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

/** Cobre User Story 4 (FR-017…FR-020) — contracts/routines.md. */
@ApiTags('routines')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação ou recurso fora do escopo de unidade do usuário',
})
@Controller('api/v1/routines')
export class RoutinesController {
  constructor(private readonly routinesService: RoutinesService) {}

  @ApiPaginatedResponse(RoutineResponseDto)
  @ApiOperation({
    summary:
      'Lista as rotinas programadas para uma data e turno, com filtros por unidade e galeria',
  })
  @Get()
  list(
    @Query() query: ListRoutinesQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<RoutineResponseDto>> {
    return this.routinesService.list(query, currentUser.units);
  }

  @ApiOperation({ summary: 'Cadastra uma rotina (somente Chefia/Diretor)' })
  @Post()
  @Roles(RoleName.WARDEN)
  create(
    @Body() dto: CreateRoutineDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<RoutineResponseDto> {
    return this.routinesService.create(dto, currentUser);
  }

  @ApiOperation({ summary: 'Ajusta os horários de uma rotina' })
  @Patch(':id/schedule')
  @Roles(RoleName.SUPERVISOR, RoleName.WARDEN)
  updateSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoutineScheduleDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<RoutineResponseDto> {
    return this.routinesService.updateSchedule(id, dto, currentUser);
  }

  @ApiOperation({ summary: 'Ativa ou desativa uma rotina, por padrão ou para uma data específica' })
  @ApiOkResponse({
    schema: {
      properties: {
        routineId: { type: 'integer' },
        date: { type: 'string', format: 'date' },
        active: { type: 'boolean' },
      },
    },
  })
  @Patch(':id/activation')
  @Roles(RoleName.SUPERVISOR, RoleName.WARDEN)
  updateActivation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoutineActivationDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{ routineId: number; date: string; active: boolean }> {
    return this.routinesService.updateActivation(id, dto, currentUser);
  }

  @ApiOperation({ summary: 'Remove uma rotina (somente Chefia/Diretor)' })
  @ApiNoContentResponse({ description: 'Rotina removida' })
  @Delete(':id')
  @Roles(RoleName.WARDEN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<void> {
    return this.routinesService.remove(id, currentUser);
  }
}
