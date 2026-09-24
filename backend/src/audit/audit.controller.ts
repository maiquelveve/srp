import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuditQueryService } from './audit-query.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditLogResponseDto } from './dto/audit-log-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RoleName } from '../roles/entities/role.entity';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

/**
 * Trilha de auditoria somente leitura (FR-026/FR-027, FR-028): sem POST/PUT/
 * PATCH/DELETE — o `AuditInterceptor` só grava em métodos que alteram dados.
 */
@ApiTags('audit')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação ou recurso fora do escopo de unidade do usuário',
})
@Roles(RoleName.SUPERVISOR, RoleName.WARDEN)
@Controller('api/v1/audit')
export class AuditController {
  constructor(private readonly auditQueryService: AuditQueryService) {}

  @ApiPaginatedResponse(AuditLogResponseDto)
  @ApiOperation({
    summary: 'Consulta a trilha de auditoria (somente leitura, restrita às unidades do usuário)',
  })
  @Get()
  list(
    @Query() query: AuditQueryDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<AuditLogResponseDto>> {
    return this.auditQueryService.list(query, currentUser.units);
  }
}
