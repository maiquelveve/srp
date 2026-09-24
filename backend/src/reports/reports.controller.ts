import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import {
  CellOccupancyHistoryQueryDto,
  InconsistenciesQueryDto,
  LongestOutOfCellQueryDto,
  MovementsByInmateQueryDto,
  RoutineExecutionQueryDto,
  StaffVsMovementsQueryDto,
} from './dto/reports-query.dto';
import {
  CellOccupancyHistoryItemDto,
  InconsistenciesReportDto,
  InmateMovementReportItemDto,
  LongestOutOfCellItemDto,
  RoutineExecutionReportDto,
  StaffVsMovementsItemDto,
} from './dto/report-responses.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

/** Cobre User Story 6 (FR-025, FR-028) — contracts/reports-audit.md. Nunca acessível a PRISON_OFFICER. */
@ApiTags('reports')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação ou recurso fora do escopo de unidade do usuário',
})
@Roles(RoleName.SUPERVISOR, RoleName.WARDEN)
@Controller('api/v1/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Relatório: movimentações de um preso no período' })
  @ApiPaginatedResponse(InmateMovementReportItemDto)
  @Get('movements-by-inmate/:inmateId')
  movementsByInmate(
    @Param('inmateId', ParseIntPipe) inmateId: number,
    @Query() query: MovementsByInmateQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<InmateMovementReportItemDto>> {
    return this.reportsService.movementsByInmate(inmateId, query, currentUser.units);
  }

  @ApiOperation({ summary: 'Relatório: presos com maior tempo fora da cela no período' })
  @ApiPaginatedResponse(LongestOutOfCellItemDto)
  @Get('longest-out-of-cell')
  longestOutOfCell(
    @Query() query: LongestOutOfCellQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<LongestOutOfCellItemDto>> {
    return this.reportsService.longestOutOfCell(query, currentUser.units);
  }

  @ApiOperation({
    summary: 'Relatório: saídas sem retorno além do prazo e presos fora da cela sem motivo',
  })
  @Get('inconsistencies')
  inconsistencies(
    @Query() query: InconsistenciesQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<InconsistenciesReportDto> {
    return this.reportsService.inconsistencies(query, currentUser.units);
  }

  @ApiOperation({ summary: 'Relatório: ocorrências de rotina programadas e desativadas por data' })
  @Get('routine-execution')
  routineExecution(
    @Query() query: RoutineExecutionQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<RoutineExecutionReportDto> {
    return this.reportsService.routineExecution(query, currentUser.units);
  }

  @ApiOperation({ summary: 'Relatório: efetivo escalado versus movimentações por turno' })
  @ApiPaginatedResponse(StaffVsMovementsItemDto)
  @Get('staff-vs-movements')
  staffVsMovements(
    @Query() query: StaffVsMovementsQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<StaffVsMovementsItemDto>> {
    return this.reportsService.staffVsMovements(query, currentUser.units);
  }

  @ApiOperation({ summary: 'Relatório: histórico de ocupação de uma cela' })
  @ApiPaginatedResponse(CellOccupancyHistoryItemDto)
  @Get('cell-occupancy-history')
  cellOccupancyHistory(
    @Query() query: CellOccupancyHistoryQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<CellOccupancyHistoryItemDto>> {
    return this.reportsService.cellOccupancyHistory(query, currentUser.units);
  }
}
