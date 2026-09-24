import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CellsService } from './cells.service';
import { CellResponseDto } from './dto/cell-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

/** `GET /api/v1/galleries/:id/cells` — nested under Galleries per contracts/structure.md. */
@ApiTags('galleries')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação ou recurso fora do escopo de unidade do usuário',
})
@Controller('api/v1/galleries')
export class GalleryCellsController {
  constructor(private readonly cellsService: CellsService) {}

  @ApiOperation({ summary: 'Lista as celas de uma galeria com a ocupação atual' })
  @ApiPaginatedResponse(CellResponseDto)
  @Get(':id/cells')
  list(
    @Param('id', ParseIntPipe) galleryId: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<CellResponseDto>> {
    return this.cellsService.listByGallery(galleryId, currentUser.units);
  }
}
