import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GalleriesService } from './galleries.service';
import { GalleryResponseDto } from './dto/gallery-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response.decorator';

/** `GET /api/v1/units/:unitId/galleries` — nested under Units per contracts/structure.md. */
@ApiTags('units')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Token de acesso ausente, inválido ou expirado' })
@ApiForbiddenResponse({
  description:
    'Perfil sem permissão para a operação ou recurso fora do escopo de unidade do usuário',
})
@Controller('api/v1/units')
export class UnitGalleriesController {
  constructor(private readonly galleriesService: GalleriesService) {}

  @ApiOperation({ summary: 'Lista as galerias de uma unidade' })
  @ApiPaginatedResponse(GalleryResponseDto)
  @Get(':unitId/galleries')
  list(
    @Param('unitId', ParseIntPipe) unitId: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<GalleryResponseDto>> {
    return this.galleriesService.listByUnit(unitId, currentUser.units);
  }
}
