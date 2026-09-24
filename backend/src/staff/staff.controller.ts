import {
  Body,
  Controller,
  Get,
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
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { ListSchedulesQueryDto } from './dto/list-schedules-query.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { MinimumStaffingQueryDto } from './dto/minimum-staffing-query.dto';
import { UpdateMinimumStaffingConfigDto } from './dto/update-minimum-staffing-config.dto';
import {
  MinimumStaffingConfigResponseDto,
  MinimumStaffingReportDto,
  ScheduleResponseDto,
} from './dto/schedule-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

/** Cobre User Story 5 (FR-021…FR-024) — contracts/staff.md. Nunca acessível a PRISON_OFFICER (FR-002). */
@ApiTags('staff')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação ou recurso fora do escopo de unidade do usuário',
})
@Controller('api/v1')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @ApiOperation({ summary: 'Lista as escalas de serviço por unidade, data, turno e posto' })
  @ApiPaginatedResponse(ScheduleResponseDto)
  @Get('schedules')
  @Roles(RoleName.SUPERVISOR, RoleName.WARDEN)
  list(
    @Query() query: ListSchedulesQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<ScheduleResponseDto>> {
    return this.staffService.listSchedules(query, currentUser.units);
  }

  @ApiOperation({ summary: 'Registra o dia de um policial: uma escala por turno, tudo ou nada' })
  @ApiPaginatedResponse(ScheduleResponseDto, HttpStatus.CREATED)
  @Post('schedules')
  @Roles(RoleName.SUPERVISOR, RoleName.WARDEN)
  create(
    @Body() dto: CreateScheduleDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<ScheduleResponseDto>> {
    return this.staffService.createSchedules(dto, currentUser);
  }

  // Declared before `schedules/:id/...` so the literal segment is never captured as an id.
  @ApiOperation({ summary: 'Efetivo por posto contra o mínimo configurado, para uma data e turno' })
  @Get('schedules/minimum-staffing')
  @Roles(RoleName.SUPERVISOR, RoleName.WARDEN)
  minimumStaffing(
    @Query() query: MinimumStaffingQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MinimumStaffingReportDto> {
    return this.staffService.minimumStaffingReport(query, currentUser.units);
  }

  @ApiOperation({ summary: 'Registra presença ou falta do policial no dia' })
  @Patch('schedules/:id/attendance')
  @Roles(RoleName.SUPERVISOR, RoleName.WARDEN)
  updateAttendance(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAttendanceDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<ScheduleResponseDto> {
    return this.staffService.updateAttendance(id, dto, currentUser);
  }

  @ApiOperation({ summary: 'Define o efetivo mínimo de um posto e turno (somente Chefia/Diretor)' })
  @Patch('staff/minimum-staffing-config')
  @Roles(RoleName.WARDEN)
  updateMinimumStaffingConfig(
    @Body() dto: UpdateMinimumStaffingConfigDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<MinimumStaffingConfigResponseDto> {
    return this.staffService.upsertMinimumStaffingConfig(dto, currentUser);
  }
}
