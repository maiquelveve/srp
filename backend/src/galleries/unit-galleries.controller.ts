import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GalleriesService } from './galleries.service';
import { GalleryResponseDto } from './dto/gallery-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';

/** `GET /api/v1/units/:unitId/galleries` — nested under Units per contracts/structure.md. */
@ApiTags('units')
@ApiBearerAuth()
@Controller('api/v1/units')
export class UnitGalleriesController {
  constructor(private readonly galleriesService: GalleriesService) {}

  @Get(':unitId/galleries')
  list(
    @Param('unitId', ParseIntPipe) unitId: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<GalleryResponseDto>> {
    return this.galleriesService.listByUnit(unitId, currentUser.units);
  }
}
