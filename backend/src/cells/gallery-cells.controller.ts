import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CellsService } from './cells.service';
import { CellResponseDto } from './dto/cell-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload.type';

/** `GET /api/v1/galleries/:id/cells` — nested under Galleries per contracts/structure.md. */
@ApiTags('galleries')
@ApiBearerAuth()
@Controller('api/v1/galleries')
export class GalleryCellsController {
  constructor(private readonly cellsService: CellsService) {}

  @Get(':id/cells')
  list(
    @Param('id', ParseIntPipe) galleryId: number,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<PaginatedResponseDto<CellResponseDto>> {
    return this.cellsService.listByGallery(galleryId, currentUser.units);
  }
}
